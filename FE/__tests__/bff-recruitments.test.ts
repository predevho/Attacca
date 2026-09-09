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

describe('BFF 구인 공고 라우트', () => {
  it('GET 목록은 scope/instrument/page 쿼리를 BE로 전달', async () => {
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/recruitments/route');
    const res = await GET(new Request('http://x/api/bff/recruitments?scope=CLOSED&instrument=PIANO&page=1'));
    expect(res.status).toBe(200);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/recruitments');
    expect(url).toContain('scope=CLOSED');
    expect(url).toContain('instrument=PIANO');
    expect(url).toContain('page=1');
  });

  it('POST 등록은 본문을 BE로 전달', async () => {
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/recruitments/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: '구인' }) }));
    expect(res.status).toBe(200);
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('GET/PUT/DELETE 단건은 BE 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const mod = await import('@/app/api/bff/recruitments/[id]/route');
    await mod.GET(new Request('http://x'), { params: Promise.resolve({ id: '7' }) });
    await mod.PUT(new Request('http://x', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ id: '7' }) });
    await mod.DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '7' }) });
    for (const c of f.mock.calls) expect(String(c[0])).toContain('/api/recruitments/7');
    expect((f.mock.calls[2][1] as RequestInit).method).toBe('DELETE');
  });

  it('POST close는 BE 마감 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/recruitments/[id]/close/route');
    await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: '7' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/recruitments/7/close');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });
});
