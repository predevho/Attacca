// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { okFetch } from './helpers/fetchMock';

const jar: Record<string, string> = { access_token: 'A' };
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function beJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('BFF 인증 연주자 어드민 라우트', () => {
  it('GET 목록은 status/page 쿼리 전달', async () => {
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/admin/verified-performers/applications/route');
    await GET(new Request('http://x/api/bff/admin/verified-performers/applications?status=APPROVED&page=1'));
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/admin/verified-performers/applications');
    expect(url).toContain('status=APPROVED');
    expect(url).toContain('page=1');
  });

  it('approve는 무body POST로 BE approve 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/admin/verified-performers/applications/[id]/approve/route');
    await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: '3' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/admin/verified-performers/applications/3/approve');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('reject/revoke는 본문(사유)과 함께 각 경로로 POST', async () => {
    for (const action of ['reject', 'revoke'] as const) {
      const f = okFetch(); vi.stubGlobal('fetch', f);
      const { POST } = await import(`@/app/api/bff/admin/verified-performers/applications/[id]/${action}/route`);
      await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ reason: 'r' }) }), { params: Promise.resolve({ id: '3' }) });
      expect(String(f.mock.calls[0][0])).toContain(`/api/admin/verified-performers/applications/3/${action}`);
      expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
      vi.unstubAllGlobals();
    }
  });

  it('grant는 본문과 함께 BE grant 경로로 POST', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/admin/verified-performers/grant/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ memberId: 5 }) }));
    expect(String(f.mock.calls[0][0])).toContain('/api/admin/verified-performers/grant');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });
});
