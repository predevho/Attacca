// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { okFetch as ok } from './helpers/fetchMock';

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

describe('BFF 피드 좋아요/댓글 라우트', () => {
  it('게시글 좋아요 POST → BE like 경로', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/feed/posts/[id]/like/route');
    await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: '5' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/feed/posts/5/like');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('게시글 좋아요 DELETE → BE like 경로 DELETE', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    const { DELETE } = await import('@/app/api/bff/feed/posts/[id]/like/route');
    await DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '5' }) });
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('댓글 목록 GET은 cursor 쿼리를 전달한다', async () => {
    const f = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => beJson({ success: true, data: { items: [], nextCursor: null }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/feed/posts/[id]/comments/route');
    await GET(new Request('http://x/api/bff/feed/posts/5/comments?cursor=3&size=20'), { params: Promise.resolve({ id: '5' }) });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/feed/posts/5/comments');
    expect(url).toContain('cursor=3');
  });

  it('댓글 삭제 DELETE → BE comments 경로', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    const { DELETE } = await import('@/app/api/bff/feed/comments/[id]/route');
    await DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '9' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/feed/comments/9');
  });

  it('댓글 좋아요 POST → BE comments like 경로', async () => {
    const f = ok(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/feed/comments/[id]/like/route');
    await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: '9' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/feed/comments/9/like');
  });
});
