import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
process.env.JWT_SECRET = 'local-catalog-boundary-test-only';
const origin = 'https://catalogo.wtgy.online';
function request(path: string, role?: string, method = 'GET') {
  const token = role ? jwt.sign({ role, userId: 'test', permissions: [] }, process.env.JWT_SECRET!, { expiresIn: '5m' }) : '';
  return new NextRequest(origin + path, { method, headers: token ? { cookie: `wt_admin_token=${token}` } : {} });
}
test('old CRM pages redirect to the independent CRM, including existing admin sessions', async () => {
  for (const path of ['/admin/crm', '/admin/inbox', '/admin/trabajo', '/admin/agente', '/admin/integraciones', '/admin/tareas', '/admin/crm/']) {
    for (const role of [undefined, 'ADMIN']) {
      const response = await middleware(request(path, role));
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), 'https://www.wtgy.online/workspace');
    }
  }
});
test('old CRM APIs cannot read or mutate even with an admin session', async () => {
  for (const path of ['/api/admin/crm/leads', '/api/admin/opportunities', '/api/admin/work-queue', '/api/admin/integrations/meta/status', '/api/admin/agent/test', '/api/invitations/accept']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await middleware(request(path, 'ADMIN', method))).status, 410);
  }
});
test('catalog operations still require authentication', async () => {
  assert.equal((await middleware(request('/api/admin/products'))).status, 401);
  assert.equal((await middleware(request('/api/admin/orders'))).status, 401);
  assert.equal((await middleware(request('/api/upload', undefined, 'POST'))).status, 401);
  assert.equal((await middleware(request('/admin/productos'))).headers.get('location'), origin + '/admin/login');
});
test('administrators, inventory staff and editors retain only permitted operations', async () => {
  assert.equal((await middleware(request('/api/admin/products', 'ADMIN', 'PUT'))).status, 200);
  assert.equal((await middleware(request('/api/admin/orders', 'INVENTORY', 'PUT'))).status, 200);
  assert.equal((await middleware(request('/api/admin/products', 'EDITOR', 'PUT'))).status, 200);
  assert.equal((await middleware(request('/api/admin/orders', 'EDITOR', 'PUT'))).status, 403);
  assert.equal((await middleware(request('/api/admin/products', 'SALES'))).status, 403);
  assert.equal((await middleware(request('/admin', 'ADMIN'))).headers.get('location'), origin + '/admin/productos');
});
