import assert from 'node:assert/strict';
import { it } from 'node:test';
import { adminCatalogsApi } from '../src/api/admin-catalogs';
import baseRequest from '../src/api/base-request';

it('sends explicit inactive filters and catalog mutations through the shared transport', async () => {
  const previous = baseRequest.defaults.adapter;
  const captured: Array<{ params?: Record<string, unknown>; url?: string; method?: string }> = [];
  baseRequest.defaults.adapter = async (config) => {
    captured.push({
      params: config.params as Record<string, unknown> | undefined,
      url: config.url,
      method: config.method,
    });
    return {
      data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  try {
    await adminCatalogsApi.categories({ isActive: false, page: 1, limit: 20 });
    await adminCatalogsApi.localities({ isActive: false, type: 'COMMUNE', page: 1, limit: 20 });
    assert.equal(captured[0]?.params?.isActive, false);
    assert.equal(captured[0]?.url, '/admin/categories');
    assert.equal(captured[1]?.params?.isActive, false);
    assert.equal(captured[1]?.params?.type, 'COMMUNE');
    assert.equal(captured[1]?.url, '/admin/localities');
  } finally {
    baseRequest.defaults.adapter = previous;
  }
});
