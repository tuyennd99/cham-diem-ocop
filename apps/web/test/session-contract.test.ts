import assert from "node:assert/strict";
import { describe, it } from "node:test";
import baseRequest from "../src/api/base-request";
import { authApi } from "../src/api/auth";
import { hasStaffPermission, normalizeSession, parseStoredSession } from "../src/lib/session-contract";
import { getSession, homeFor, setSession } from "../src/lib/auth";
import { SESSION_STORAGE_KEY } from "../src/stores/session-store";
import type { Session } from "../src/types/auth";

const viewer: Session = {
  accessToken: "token",
  user: {
    id: "viewer-1", email: "viewer@example.test", fullName: "Viewer", phone: null,
    role: "VIEWER", verified: true, staffPermissions: ["VIEW"],
    organizationUnitId: "unit-1", organizationUnit: { id: "unit-1", code: "U1", name: "Unit 1" },
  },
};

describe("client session permissions", () => {
  it("persists and restores VIEWER permissions and organization unit", () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      } },
    });
    try {
      setSession(viewer);
      assert.deepEqual(parseStoredSession(values.get(SESSION_STORAGE_KEY) ?? null), viewer);
      assert.deepEqual(getSession(), viewer);
    } finally {
      setSession(null);
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
    assert.deepEqual(normalizeSession({ accessToken: "legacy", user: { ...viewer.user, staffPermissions: undefined } })?.user.staffPermissions, ["VIEW"]);
  });

  it("keeps public startup working when localStorage is blocked", async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { get localStorage() { throw new DOMException("Blocked", "SecurityError"); } },
    });
    try {
      const storeUrl = new URL("../src/stores/session-store.ts", import.meta.url);
      storeUrl.searchParams.set("blocked-storage", "1");
      const freshStore = await import(storeUrl.href);
      assert.equal(freshStore.getSession(), null);
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("does not let an old /auth/me response overwrite a newer session", async () => {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      } },
    });
    const previousAdapter = baseRequest.defaults.adapter;
    let releaseResponse: () => void = () => {};
    try {
      setSession(viewer);
      baseRequest.defaults.adapter = (config) => new Promise((resolve) => {
        releaseResponse = () => resolve({
          data: { data: { ...viewer.user, fullName: "Old response" } },
          status: 200, statusText: "OK", headers: {}, config,
        });
      });
      const request = authApi.me();
      await new Promise((resolve) => setImmediate(resolve));
      const newerSession: Session = { ...viewer, accessToken: "new-token", user: { ...viewer.user, id: "new-user" } };
      setSession(newerSession);
      releaseResponse();
      await request;
      assert.deepEqual(getSession(), newerSession);
    } finally {
      baseRequest.defaults.adapter = previousAdapter;
      try { setSession(null); } catch { /* Restore test globals even when storage is unavailable. */ }
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("normalizes a legacy ADMIN session to MANAGE and VIEW", () => {
    const normalized = normalizeSession({
      accessToken: "token", user: { ...viewer.user, role: "ADMIN", staffPermissions: undefined,
        organizationUnitId: null, organizationUnit: null },
    });
    assert.deepEqual(normalized?.user.staffPermissions, ["MANAGE", "VIEW"]);
  });

  it("normalizes legacy JUDGE sessions to SCORE access", () => {
    const user = normalizeSession({ accessToken: "legacy", user: { ...viewer.user, role: "JUDGE", staffPermissions: undefined } })?.user;
    assert.deepEqual(user?.staffPermissions, ["SCORE"]);
    assert.equal(hasStaffPermission(user, "SCORE"), true);
    assert.equal(hasStaffPermission(user, "MANAGE"), false);
    assert.equal(hasStaffPermission(user, "VIEW"), false);
    assert.equal(homeFor(user!.role, user!.staffPermissions), "/judge");
  });

  it("allows combined MANAGE and SCORE sessions into both areas", () => {
    const user = { ...viewer.user, role: "ADMIN" as const, staffPermissions: ["MANAGE", "VIEW", "SCORE"] as ("MANAGE" | "VIEW" | "SCORE")[] };
    assert.equal(hasStaffPermission(user, "MANAGE"), true);
    assert.equal(hasStaffPermission(user, "VIEW"), true);
    assert.equal(hasStaffPermission(user, "SCORE"), true);
    assert.equal(homeFor(user.role, user.staffPermissions), "/admin/products");
  });

  it("prefers SCORE over VIEW for combined VIEW and SCORE sessions", () => {
    assert.equal(homeFor("JUDGE", ["VIEW", "SCORE"]), "/judge");
  });
});
