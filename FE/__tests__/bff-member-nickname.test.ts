// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jar: Record<string, string> = { access_token: 'A' };
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('PATCH /api/bff/members/me', () => {
  it('닉네임 JSON을 인증 헤더와 함께 BE로 전달한다', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ success: true, data: { nickname: '새 닉네임' }, error: null }),
      { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { PATCH } = await import('@/app/api/bff/members/me/route');
    const req = new Request('http://localhost/api/bff/members/me', {
      method: 'PATCH', body: JSON.stringify({ nickname: '새 닉네임' }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const calls = (fetchMock as unknown as { mock: { calls: [RequestInfo | URL, RequestInit][] } }).mock.calls;
    expect(String(calls[0][0])).toContain('/api/members/me');
    const init = calls[0][1];
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer A');
    expect(JSON.parse(init.body as string)).toEqual({ nickname: '새 닉네임' });
  });
});
