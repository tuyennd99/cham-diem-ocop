import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function waitForTunnel(ssh) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => finish(new Error('SSH tunnel did not become ready within 30 seconds.')), 30_000);

    function finish(error) {
      clearTimeout(timer);
      ssh.stderr.off('data', onData);
      ssh.off('error', onError);
      ssh.off('close', onClose);
      ssh.stderr.resume();
      if (error) reject(error);
      else resolve();
    }

    function onData(chunk) {
      output = (output + chunk.toString()).slice(-16_384);
      if (/Local forwarding listening on 127\.0\.0\.1 port 15432\b/.test(output)
        && output.includes('Entering interactive session.')) finish();
    }

    function onError(error) {
      finish(error);
    }

    function onClose(code) {
      const message = output.split(/\r?\n/).filter(line => line && !/^debug\d:/.test(line)).join('\n');
      finish(new Error(message || `SSH exited before the tunnel was ready (code ${code}).`));
    }

    ssh.stderr.on('data', onData);
    ssh.once('error', onError);
    ssh.once('close', onClose);
  });
}

function stopDev(dev) {
  if (!dev || dev.exitCode !== null || dev.signalCode !== null) return;
  if (process.platform === 'win32' && dev.pid) {
    try {
      const killer = spawn('taskkill', ['/PID', String(dev.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.on('error', () => dev.kill());
      killer.on('close', code => { if (code !== 0) dev.kill(); });
    } catch {
      dev.kill();
    }
  } else if (dev.pid) {
    try { process.kill(-dev.pid, 'SIGTERM'); } catch { dev.kill(); }
  } else {
    dev.kill();
  }
}

export async function runDevCloud(ssh, startDev) {
  let dev;
  let interrupted = 0;
  let devStopped = false;
  const stopCurrentDev = () => {
    if (dev && !devStopped) {
      devStopped = true;
      stopDev(dev);
    }
  };
  const stop = code => {
    interrupted = code;
    ssh.kill();
    stopCurrentDev();
  };
  const onInterrupt = () => stop(130);
  const onTerminate = () => stop(143);
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onTerminate);

  try {
    await waitForTunnel(ssh);
    if (interrupted) return interrupted;
    if (ssh.exitCode != null || ssh.signalCode != null) throw new Error('SSH tunnel closed before the app started.');
    dev = startDev();
    return await new Promise((resolve, reject) => {
      ssh.once('error', reject);
      ssh.once('close', () => interrupted ? resolve(interrupted) : reject(new Error('SSH tunnel closed; database connection is unavailable.')));
      dev.once('error', reject);
      dev.once('close', code => resolve(interrupted || (code ?? 1)));
    });
  } catch (error) {
    if (interrupted) return interrupted;
    throw error;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    ssh.kill();
    stopCurrentDev();
  }
}

async function main() {
  try {
    const ssh = spawn('ssh', [
      '-v', '-N',
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=15',
      '-o', 'ControlMaster=no',
      '-o', 'ControlPath=none',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-L', '127.0.0.1:15432:127.0.0.1:5432',
      'ocop-cloud',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    console.log('Opening the OCOP SSH tunnel...');
    process.exitCode = await runDevCloud(ssh, () => {
      const pnpm = process.env.npm_execpath;
      if (!pnpm) throw new Error('Start this script with pnpm dev:cloud.');
      const isNodeScript = /\.(?:cjs|mjs|js)$/i.test(pnpm);
      console.log('SSH tunnel ready. Starting pnpm dev...');
      return spawn(isNodeScript ? process.execPath : pnpm, isNodeScript ? [pnpm, 'dev'] : ['dev'], {
        stdio: 'inherit',
        detached: process.platform !== 'win32',
      });
    });
  } catch (error) {
    console.error(`Could not start dev:cloud: ${error.message}`);
    console.error('Check the SSH key, the ocop-cloud host in ~/.ssh/config, and port 15432.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
