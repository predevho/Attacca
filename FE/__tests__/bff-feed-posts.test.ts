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

describe('BFF 피드 게시글 라우트', () => {
  it('GET 목록은 cursor/size 쿼리를 BE로 전달한다', async () => {
    const fetchMock = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { items: [], nextCursor: null }, error: null }));
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/feed/posts/route');

    const res = await GET(new Request('http://localhost/api/bff/feed/posts?cursor=10&size=20'));
    expect(res.status).toBe(200);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/feed/posts');
    expect(url).toContain('cursor=10');
    expect(url).toContain('size=20');
  });

  it('POST 작성은 본문을 BE로 전달한다', async () => {
    const fetchMock = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/bff/feed/posts/route');

    const res = await POST(new Request('http://localhost/api/bff/feed/posts', {
      method: 'POST', body: JSON.stringify({ content: '안녕' }),
    }));
    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ content: '안녕' }));
  });

  it('DELETE 단건은 BE 단건 경로로 프록시한다', async () => {
    const fetchMock = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: null, error: null }));
    vi.stubGlobal('fetch', fetchMock);
    const { DELETE } = await import('@/app/api/bff/feed/posts/[id]/route');

    const res = await DELETE(new Request('http://localhost/x', { method: 'DELETE' }), { params: Promise.resolve({ id: '42' }) });
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/feed/posts/42');
  });
});
