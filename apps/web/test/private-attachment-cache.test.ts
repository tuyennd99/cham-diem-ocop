import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import baseRequest from '../src/api/base-request';
import {
  clearAttachmentBlobCache,
  getCachedAttachmentObjectUrl,
  isStaleAttachmentSessionError,
  loadAttachmentWithCache,
  syncPrivateAttachmentLoad,
} from '../src/lib/private-attachment-cache';
import { setSession } from '../src/stores/session-store';
import type { Session } from '../src/types/auth';

function makeSession(id: string, accessToken: string, fullName = `User ${id}`): Session {
  return {
    accessToken,
    user: {
      id,
      email: `${id}@example.test`,
      fullName,
      phone: null,
      role: 'ADMIN',
      roles: ['ADMIN', 'VIEWER'],
      verified: true,
      staffPermissions: ['MANAGE', 'VIEW'],
      organizationUnitId: null,
      organizationUnit: null,
    },
  };
}

interface DeferredBlob {
  url?: string;
  resolve: (blob: Blob) => void;
  reject: (err: unknown) => void;
}

describe('private attachment cache session isolation (#58)', () => {
  const previousAdapter = baseRequest.defaults.adapter;
  const previousCreateObjectURL = URL.createObjectURL;
  const previousRevokeObjectURL = URL.revokeObjectURL;
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];
  let nextUrlSeq = 0;

  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    nextUrlSeq = 0;

    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    });

    URL.createObjectURL = () => {
      const url = `blob:test-${++nextUrlSeq}`;
      createdUrls.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };

    setSession(null);
    clearAttachmentBlobCache();
  });

  afterEach(() => {
    baseRequest.defaults.adapter = previousAdapter;
    URL.createObjectURL = previousCreateObjectURL;
    URL.revokeObjectURL = previousRevokeObjectURL;
    try {
      setSession(null);
      clearAttachmentBlobCache();
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('deduplicates concurrent loads in the same session and revokes URLs on logout or account switch', async () => {
    let requestCount = 0;
    baseRequest.defaults.adapter = async (config) => {
      requestCount += 1;
      return {
        data: new Blob([`payload-${requestCount}`], { type: 'image/png' }),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    const userA = makeSession('user-a', 'token-a');
    setSession(userA);

    const [first, second] = await Promise.all([
      loadAttachmentWithCache('admin', 'prod-1', 'att-1'),
      loadAttachmentWithCache('admin', 'prod-1', 'att-1'),
    ]);

    assert.equal(requestCount, 1);
    assert.equal(first.objectUrl, 'blob:test-1');
    assert.equal(second.objectUrl, 'blob:test-1');
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-1'), 'blob:test-1');

    // Name-only update in the same session keeps cached object URL intact.
    setSession(makeSession('user-a', 'token-a', 'User A Renamed'));
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-1'), 'blob:test-1');
    assert.deepEqual(revokedUrls, []);

    // Token or permission change for the same user ID clears cache and revokes object URLs.
    setSession(makeSession('user-a', 'token-a-rotated'));
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-1'), null);
    assert.deepEqual(revokedUrls, ['blob:test-1']);

    const rotatedEntry = await loadAttachmentWithCache('admin', 'prod-1', 'att-1');
    assert.equal(requestCount, 2);
    assert.equal(rotatedEntry.objectUrl, 'blob:test-2');

    // Logout clears cache and revokes the active object URL.
    setSession(null);
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-1'), null);
    assert.deepEqual(revokedUrls, ['blob:test-1', 'blob:test-2']);

    // New user fetches fresh attachment and revokes it when switching accounts directly.
    setSession(makeSession('user-b', 'token-b'));
    const userBEntry = await loadAttachmentWithCache('admin', 'prod-1', 'att-1');
    assert.equal(requestCount, 3);
    assert.equal(userBEntry.objectUrl, 'blob:test-3');

    setSession(makeSession('user-c', 'token-c'));
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-1'), null);
    assert.deepEqual(revokedUrls, ['blob:test-1', 'blob:test-2', 'blob:test-3']);
  });

  it('ignores late responses from a previous session without writing cache, updating UI, or deleting new inflight requests', async () => {
    const pending: DeferredBlob[] = [];
    baseRequest.defaults.adapter = (config) =>
      new Promise((resolve, reject) => {
        pending.push({
          url: config.url,
          resolve: (blob) =>
            resolve({
              data: blob,
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            }),
          reject,
        });
      });

    setSession(makeSession('user-a', 'token-a'));

    const uiUpdatesFromA: string[] = [];
    const uiErrorsFromA: unknown[] = [];
    // Intentionally do NOT invoke the cleanup callback to prove session guard alone blocks stale UI updates.
    syncPrivateAttachmentLoad('admin', 'prod-1', 'att-shared', {
      onSuccess: (entry) => uiUpdatesFromA.push(entry.objectUrl),
      onError: (err) => uiErrorsFromA.push(err),
    });
    const loadFromA = loadAttachmentWithCache('admin', 'prod-1', 'att-shared');
    await new Promise((resolve) => setImmediate(resolve));

    // Only one HTTP request was issued for both callers in session A.
    assert.equal(pending.length, 1);

    // Switch directly to session B while session A's request is still in flight.
    setSession(makeSession('user-b', 'token-b'));

    const uiUpdatesFromB: string[] = [];
    const uiErrorsFromB: unknown[] = [];
    syncPrivateAttachmentLoad('admin', 'prod-1', 'att-shared', {
      onSuccess: (entry) => uiUpdatesFromB.push(entry.objectUrl),
      onError: (err) => uiErrorsFromB.push(err),
    });
    const loadFromB1 = loadAttachmentWithCache('admin', 'prod-1', 'att-shared');
    const loadFromB2 = loadAttachmentWithCache('admin', 'prod-1', 'att-shared');
    await new Promise((resolve) => setImmediate(resolve));

    // Session B starts its own single deduplicated request (not reusing session A's).
    assert.equal(pending.length, 2);
    assert.strictEqual(loadFromB1, loadFromB2);

    // Session A's slow response arrives late.
    pending[0].resolve(new Blob(['secret-from-user-a'], { type: 'image/png' }));
    await assert.rejects(loadFromA, (err) => isStaleAttachmentSessionError(err));
    await new Promise((resolve) => setImmediate(resolve));

    // Stale response did NOT create an object URL, write to cache, update UI, or evict session B's inflight request.
    assert.deepEqual(createdUrls, []);
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-shared'), null);
    assert.deepEqual(uiUpdatesFromA, []);
    assert.deepEqual(uiErrorsFromA, []);
    assert.deepEqual(uiUpdatesFromB, []);
    assert.deepEqual(uiErrorsFromB, []);

    // A third caller in session B STILL shares session B's inflight request (not disrupted by session A settling).
    const loadFromB3 = loadAttachmentWithCache('admin', 'prod-1', 'att-shared');
    assert.equal(pending.length, 2);
    assert.strictEqual(loadFromB3, loadFromB1);

    // Session B's response arrives and populates cache and UI cleanly.
    pending[1].resolve(new Blob(['data-for-user-b'], { type: 'image/png' }));
    const entryB = await loadFromB1;
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(entryB.objectUrl, 'blob:test-1');
    assert.equal(await entryB.blob.text(), 'data-for-user-b');
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-shared'), 'blob:test-1');
    assert.deepEqual(uiUpdatesFromA, []);
    assert.deepEqual(uiErrorsFromA, []);
    assert.deepEqual(uiUpdatesFromB, ['blob:test-1']);
    assert.deepEqual(uiErrorsFromB, []);
  });

  it('ignores late errors from a previous session without surfacing stale UI errors', async () => {
    const pending: DeferredBlob[] = [];
    baseRequest.defaults.adapter = () =>
      new Promise((_resolve, reject) => {
        pending.push({
          resolve: () => {},
          reject,
        });
      });

    setSession(makeSession('user-a', 'token-a'));
    const uiErrorsFromA: unknown[] = [];
    syncPrivateAttachmentLoad('admin', 'prod-1', 'att-err', {
      onSuccess: () => {},
      onError: (err) => uiErrorsFromA.push(err),
    });
    const loadFromA = loadAttachmentWithCache('admin', 'prod-1', 'att-err');
    await new Promise((resolve) => setImmediate(resolve));

    setSession(null);

    pending[0].reject(new Error('network timeout'));
    await assert.rejects(loadFromA, (err) => isStaleAttachmentSessionError(err));
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(uiErrorsFromA, []);
    assert.equal(getCachedAttachmentObjectUrl('prod-1', 'att-err'), null);
  });
});
