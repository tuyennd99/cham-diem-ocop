import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { runDevCloud, waitForTunnel } from './dev-cloud.mjs';

test('waits for the SSH process to confirm the requested local port', async () => {
  const ssh = new EventEmitter();
  ssh.stderr = new PassThrough();
  let ready = false;
  const waiting = waitForTunnel(ssh).then(() => { ready = true; });
  ssh.stderr.write('debug1: Local forwarding listen');
  assert.equal(ready, false);
  ssh.stderr.write('ing on 127.0.0.1 port 15432.\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, false);
  ssh.stderr.write('debug1: Entering interactive session.\n');
  await waiting;
  assert.equal(ready, true);
});

test('fails instead of starting the app when SSH cannot bind the port', async () => {
  const ssh = new EventEmitter();
  ssh.stderr = new PassThrough();
  const waiting = waitForTunnel(ssh);
  ssh.stderr.write('debug1: Local forwarding listening on 127.0.0.1 port 15432.\nbind [127.0.0.1]:15432: Address already in use\n');
  ssh.emit('close', 255);
  await assert.rejects(waiting, /Address already in use/);
});

test('starts the app only after SSH is ready and closes its tunnel when the app exits', async () => {
  const ssh = new EventEmitter();
  ssh.stderr = new PassThrough();
  ssh.kill = () => { ssh.killed = true; };
  const dev = new EventEmitter();
  dev.exitCode = null;
  dev.signalCode = null;
  let started = false;
  const running = runDevCloud(ssh, () => { started = true; return dev; });

  assert.equal(started, false);
  ssh.stderr.write('debug1: Local forwarding listening on 127.0.0.1 port 15432.\ndebug1: Entering interactive session.\n');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started, true);
  dev.exitCode = 0;
  dev.emit('close', 0);
  assert.equal(await running, 0);
  assert.equal(ssh.killed, true);
});

test('stops the app when its SSH tunnel is lost', async () => {
  const ssh = new EventEmitter();
  ssh.stderr = new PassThrough();
  ssh.kill = () => {};
  const dev = new EventEmitter();
  dev.exitCode = null;
  dev.signalCode = null;
  dev.kill = () => { dev.killed = true; };
  const running = runDevCloud(ssh, () => dev);

  ssh.stderr.write('debug1: Local forwarding listening on 127.0.0.1 port 15432.\ndebug1: Entering interactive session.\n');
  await new Promise(resolve => setImmediate(resolve));
  ssh.emit('close', 255);
  await assert.rejects(running, /SSH tunnel closed/);
  assert.equal(dev.killed, true);
});

test('reports failure if the app process ends by signal', async () => {
  const ssh = new EventEmitter();
  ssh.stderr = new PassThrough();
  ssh.kill = () => {};
  const dev = new EventEmitter();
  dev.exitCode = null;
  dev.signalCode = null;
  dev.kill = () => {};
  const running = runDevCloud(ssh, () => dev);

  ssh.stderr.write('debug1: Local forwarding listening on 127.0.0.1 port 15432.\ndebug1: Entering interactive session.\n');
  await new Promise(resolve => setImmediate(resolve));
  dev.signalCode = 'SIGTERM';
  dev.emit('close', null, 'SIGTERM');
  assert.equal(await running, 1);
});
