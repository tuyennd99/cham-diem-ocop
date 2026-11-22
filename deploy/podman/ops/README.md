# Trung tâm Vận hành & Sao lưu (`/srv/apps/ops`)

Thư mục này chứa cấu hình chuẩn hóa cho các dịch vụ vận hành và sao lưu chạy trên Rootless Podman tại `/srv/apps/ops` trên VPS (`ocop-cloud`).

## Thành phần dịch vụ (`compose.yaml`)

- **Caddy** (`:18080`, chuyển sang `:80/:443` sau `sudo-bootstrap.sh`): Reverse proxy.
- **Dozzle** (`127.0.0.1:9999`): Xem log container theo thời gian thực.
- **Uptime Kuma v2** (`127.0.0.1:3001`, `louislam/uptime-kuma:2`): Giám sát trạng thái dịch vụ (HTTP, TCP, PostgreSQL, Redis...).
- **Beszel Hub & Beszel Agent** (`127.0.0.1:8090`, `henrygd/beszel:latest` + `henrygd/beszel-agent:latest`): Giám sát tài nguyên máy chủ (CPU, RAM, Disk `/` `vda2` + `/srv` `vdb`, băng thông `eth0`/`tailscale0`) và thống kê từng container Rootless Podman kèm lịch sử và cảnh báo.
- **n8n** (`127.0.0.1:5678`): Tự động hóa quy trình thông báo/tác vụ.
- **Backrest** (`127.0.0.1:9898`): Giao diện web và bộ điều phối sao lưu chống trùng lặp **Restic** (mã hóa AES-256).

---

## Giám sát Tài nguyên & Container với Beszel (`127.0.0.1:8090`)

Beszel Hub chỉ bind vào `127.0.0.1:8090` trên VPS và giao tiếp nội bộ với `beszel-agent` qua Unix socket `/srv/storage/ops/beszel-socket/beszel.sock` (`/beszel_socket/beszel.sock` trong container) mà không cần mở thêm cổng TCP trên host.

### 1. Truy cập Giao diện Web Beszel Hub

Mở qua SSH port-forward từ máy cá nhân (hoặc qua Tailscale):

```bash
ssh -N -L 8090:127.0.0.1:8090 ocop-cloud
```

Sau đó mở trình duyệt tại `http://127.0.0.1:8090`.

### 2. Thiết lập lần đầu trên Giao diện Web

1. Ở lần truy cập đầu tiên, tạo tài khoản quản trị viên (email + mật khẩu mạnh) trên Beszel Hub.
2. Nhấn **+ Add System** (Thêm máy chủ):
   - **Name**: `ocop-cloud`
   - **Host / IP**: `/beszel_socket/beszel.sock`
   - **Public Key**: Khóa công khai Ed25519 của Hub (sinh tự động từ `/srv/storage/ops/beszel/id_ed25519`) đã được nạp sẵn vào `/srv/apps/ops/.env` (`BESZEL_KEY=ssh-ed25519 ...`, quyền `600`) trên VPS nên `beszel-agent` sẵn sàng kết nối ngay khi nhấn **Add system**.
3. Nếu khởi tạo lại thư mục `/srv/storage/ops/beszel` trên máy chủ mới, cập nhật khóa công khai vào `/srv/apps/ops/.env` và khởi động lại agent:

```bash
PUBKEY=$(ssh-keygen -y -f /srv/storage/ops/beszel/id_ed25519)
printf 'BESZEL_KEY=%s\n' "$PUBKEY" > /srv/apps/ops/.env
chmod 600 /srv/apps/ops/.env
cd /srv/apps/ops && COMPOSE_PARALLEL_LIMIT=1 podman compose up -d --no-deps beszel-agent
```

---

## Hệ thống Sao lưu & Bảo trì Đêm (Restic + Backrest + systemd timer)

### 1. Lịch trình tự động mỗi đêm (`Asia/Ho_Chi_Minh`)

1. **`02:00:00` — `ocop-maintenance.timer` → `ocop-maintenance.service`**
   Chạy `/srv/apps/ops/backup-maintenance.sh` trên VPS để:
   - Xóa các bản ghi `pending_auth` đã quá hạn (`"expiresAt" <= NOW()`) trong cả `chamdiemocop_prod` và `chamdiemocop_dev`.
   - Xuất bản sao nhất quán (`pg_dump -Fc`) cho `chamdiemocop_prod`, `chamdiemocop_dev` và `kh2959` vào `/srv/storage/backups/staging/postgres/<db>.dump` (ghi tạm `*.tmp` rồi `mv`, kiểm tra file khác rỗng, quyền `600`).
2. **`02:15:00` — Backrest plan `ocop-nightly`**
   Chụp snapshot chống trùng lặp vào kho Restic `/repos/ocop-vps` cho 3 nguồn:
   - `/userdata/postgres` (`/srv/storage/backups/staging/postgres`)
   - `/userdata/ocop-uploads` (`/srv/storage/cham-diem-ocop/uploads`)
   - `/userdata/n8n` (`/srv/storage/ops/n8n`)
   Chính sách lưu giữ (`retention`): **14 daily**, **4 weekly**, **3 monthly** (`prune` và `check` định kỳ cuối tuần).

### 2. Vị trí dữ liệu & Bí mật trên VPS (Không lưu trong Git)

- Kho Restic mã hóa: `/srv/storage/backups/restic-repo/ocop-vps` (chmod `700`)
- File mật khẩu kho Restic: `/srv/storage/backups/backrest-config/.restic-password` (chmod `600`)
- Cấu hình Backrest: `/srv/storage/backups/backrest-config/config.json` (chmod `600`)
- Dữ liệu staging PostgreSQL: `/srv/storage/backups/staging/postgres/*.dump`

> **Lưu ý quan trọng**: Mất `.restic-password` đồng nghĩa không thể giải mã kho sao lưu. Quản trị viên cần sao lưu bản copy của `/srv/storage/backups/backrest-config/.restic-password` và `config.json` vào trình quản lý mật khẩu ngoại tuyến an toàn.

### 3. Truy cập Giao diện Web Backrest (`127.0.0.1:9898`) & Thiết lập Đăng nhập

Backrest chỉ bind vào `127.0.0.1:9898` trên VPS (không mở ra internet công cộng).

Mở qua SSH port-forward từ máy cá nhân (hoặc qua Tailscale khi đã cấu hình):

```bash
ssh -N -L 9898:127.0.0.1:9898 ocop-cloud
```

Sau đó mở trình duyệt tại `http://127.0.0.1:9898`.

**Hoàn tất / quản lý đăng nhập UI:**
1. Mặc định khi khởi tạo tự động không mật khẩu để tránh khóa cấu hình ban đầu (`auth.disabled: true` khi truy cập qua localhost tunnel).
2. Ngay khi mở giao diện web lần đầu (đặc biệt trước khi chia sẻ qua Tailscale), vào **Settings → Authentication**:
   - Bỏ chọn **Disable Authentication**.
   - Thêm tài khoản quản trị (username + mật khẩu mạnh) và nhấn **Save**.
3. Nếu cần đặt lại đăng nhập UI sau này, SSH vào VPS, tạm sửa `"auth"` trong `/srv/storage/backups/backrest-config/config.json` và khởi động lại container `backrest` (`COMPOSE_PARALLEL_LIMIT=1 podman compose restart backrest` tại `/srv/apps/ops`).

---

## Quy trình Kiểm tra & Khôi phục (Restore)

### Khôi phục nhanh trên Giao diện Web Backrest
1. Mở `http://127.0.0.1:9898` → chọn plan **`ocop-nightly`** hoặc repo **`ocop-vps`**.
2. Chọn ngày/snapshot cần khôi phục → duyệt cây thư mục (`/userdata/postgres`, `/userdata/ocop-uploads`, `/userdata/n8n`) → tải tệp trực tiếp hoặc chọn khôi phục.

### Khôi phục qua CLI (`restic` trong container `backrest`)

Liệt kê các snapshot hiện có:

```bash
podman exec backrest restic -r /repos/ocop-vps --password-file /config/.restic-password snapshots
```

Khôi phục thử 1 tệp hoặc 1 snapshot ra thư mục tạm trên VPS:

```bash
mkdir -p /tmp/restic-restore-test
podman run --rm --userns=keep-id --entrypoint /bin/restic \
  -v /srv/storage/backups/restic-repo:/repos:ro \
  -v /srv/storage/backups/backrest-config:/config:ro \
  -v /tmp/restic-restore-test:/restore \
  docker.io/garethgeorge/backrest:latest \
  --no-cache --no-lock -r /repos/ocop-vps --password-file /config/.restic-password \
  restore latest --target /restore --include /userdata/postgres/chamdiemocop_prod.dump
```

Kiểm tra cấu trúc bản dump PostgreSQL (chỉ đọc, không ghi đè DB chạy thật):

```bash
podman exec -i postgres-db pg_restore --list < /tmp/restic-restore-test/userdata/postgres/chamdiemocop_prod.dump | head -n 30
```

Nếu cần khôi phục vào cơ sở dữ liệu (chỉ thực hiện khi đã xác định đúng DB đích và đã sao lưu trạng thái hiện tại):

```bash
podman exec -i postgres-db pg_restore -U postgres --clean --if-exists -d <target_db> < /tmp/restic-restore-test/userdata/postgres/<db>.dump
```

Dọn thư mục thử nghiệm sau khi kiểm tra:

```bash
rm -rf /tmp/restic-restore-test
```

---

## Cài đặt `systemd --user` Timer trên VPS

```bash
mkdir -p ~/.config/systemd/user
cp /srv/apps/ops/systemd/ocop-maintenance.service ~/.config/systemd/user/
cp /srv/apps/ops/systemd/ocop-maintenance.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now ocop-maintenance.timer
systemctl --user list-timers --all
```
