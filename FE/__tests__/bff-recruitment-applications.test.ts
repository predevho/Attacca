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
const okFetch = () => vi.fn(async () => beJson({ success: true, data: null, error: null }));

describe('BFF 구인 지원 라우트', () => {
  it('POST 지원은 공고별 applications 경로에 본문 전달', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/recruitments/[id]/applications/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ message: '지원합니다' }) }), { params: Promise.resolve({ id: '7' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/recruitments/7/applications');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('GET 지원자 목록은 page 쿼리 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/recruitments/[id]/applications/route');
    await GET(new Request('http://x/api/bff/recruitments/7/applications?page=1'), { params: Promise.resolve({ id: '7' }) });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/recruitments/7/applications');
    expect(url).toContain('page=1');
  });

  it('GET 내 지원은 BE applications/me 경로', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/recruitments/applications/me/route');
    await GET(new Request('http://x/api/bff/recruitments/applications/me?page=0'));
    expect(String(f.mock.calls[0][0])).toContain('/api/recruitments/applications/me');
  });

  it('accept/reject/withdraw는 각 BE 경로에 POST', async () => {
    for (const action of ['accept', 'reject', 'withdraw'] as const) {
      const f = okFetch(); vi.stubGlobal('fetch', f);
      const { POST } = await import(`@/app/api/bff/recruitments/applications/[aid]/${action}/route`);
      await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ aid: '3' }) });
      expect(String(f.mock.calls[0][0])).toContain(`/api/recruitments/applications/3/${action}`);
      expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
      vi.unstubAllGlobals();
    }
  });
});
