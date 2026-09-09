// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('BFF 신원 라우트', () => {
  it('GET → BE /api/members/me로 프록시하고 신원을 반환', async () => {
    const fetchMock = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson(
      { success: true, data: { id: 7, nickname: '유저', role: 'USER', verified: false }, error: null }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/me/identity/route');

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe(7);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/members/me');
  });

  it('BE 연결 실패면 502를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const { GET } = await import('@/app/api/bff/me/identity/route');
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
