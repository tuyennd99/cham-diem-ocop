#!/usr/bin/env bash
set -euo pipefail

# One-time idempotent host bootstrap script for OCOP VPS (Ubuntu 24.04 + Rootless Podman).
# Usage: sudo bash /srv/apps/sudo-bootstrap.sh

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "ERROR: Script nay can chay voi quyen root: sudo bash /srv/apps/sudo-bootstrap.sh" >&2
  exit 1
fi

echo "==> [1/4] Cho phep Rootless Podman mo cong >= 80 (net.ipv4.ip_unprivileged_port_start=80)"
cat <<'EOF' > /etc/sysctl.d/99-podman-unprivileged-ports.conf
net.ipv4.ip_unprivileged_port_start=80
EOF
sysctl --system >/dev/null
sysctl net.ipv4.ip_unprivileged_port_start

echo "==> [2/4] Cai dat va kich hoat Tailscale"
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled

TAILSCALE_NEEDS_UP=0
if tailscale status >/dev/null 2>&1; then
  echo "Tailscale da xac thuc. IP Tailscale: $(tailscale ip -4 2>/dev/null | head -n 1 || echo 'unknown')"
else
  TAILSCALE_NEEDS_UP=1
  echo "Tailscale da cai dat nhung chua dang nhap."
fi

echo "==> [3/4] Cai dat va cau hinh Fail2ban"
if ! dpkg -s fail2ban >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban
fi

mkdir -p /etc/fail2ban/jail.d /etc/fail2ban/filter.d

cat <<'EOF' > /etc/fail2ban/jail.d/ocop-vps.local
[sshd]
enabled = true
port = ssh
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF

if [[ -f /var/log/xrdp-sesman.log ]]; then
  cat <<'EOF' > /etc/fail2ban/filter.d/xrdp.conf
[Definition]
failregex = ^.*AUTHFAIL: user=\S+ ip=<HOST> time=\d*$
ignoreregex =
EOF

  cat <<'EOF' >> /etc/fail2ban/jail.d/ocop-vps.local

[xrdp]
enabled = true
port = 3389
filter = xrdp
backend = auto
logpath = /var/log/xrdp-sesman.log
maxretry = 5
findtime = 10m
bantime = 1h
EOF
fi

systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status || true

echo "==> [4/4] Cau hinh va kich hoat UFW (mo san SSH/Web/XRDP/Tailscale truoc khi enable)"
if ! command -v ufw >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ufw
fi

ufw default deny incoming
ufw default allow outgoing

ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (Caddy)'
ufw allow 443/tcp comment 'HTTPS (Caddy)'
ufw allow 5173/tcp comment 'OCOP Web'
ufw allow 5185/tcp comment 'KH2959 Web'
ufw allow 3389/tcp comment 'XRDP'
ufw allow 41641/udp comment 'Tailscale WireGuard'
ufw allow in on tailscale0 comment 'Tailscale private network'

ufw --force enable
ufw status verbose

echo ""
echo "======================================================================"
echo "HOAN TAT sudo-bootstrap.sh!"
echo "Buoc tiep theo (chay voi user dev, khong can sudo cho Podman):"
if [[ "${TAILSCALE_NEEDS_UP}" -eq 1 ]]; then
  echo "1. Dang nhap Tailscale de truy cap rieng tu Dozzle/Backrest/Kuma/n8n:"
  echo "   sudo tailscale up"
  echo "2. Chuyen cong Caddy trong /srv/apps/ops/compose.yaml tu 18080:80 -> 80:80"
else
  echo "1. Chuyen cong Caddy trong /srv/apps/ops/compose.yaml tu 18080:80 -> 80:80"
fi
echo "   sed -i 's/\"18080:80\"/\"80:80\"/' /srv/apps/ops/compose.yaml"
echo "   cd /srv/apps/ops && COMPOSE_PARALLEL_LIMIT=1 podman compose up -d --force-recreate caddy"
echo "   curl -fsSI http://127.0.0.1:80"
echo "======================================================================"
