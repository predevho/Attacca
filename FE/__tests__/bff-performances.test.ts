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

describe('BFF 공연 라우트', () => {
  it('GET 목록은 scope/page 쿼리를 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/performances/route');
    const res = await GET(new Request('http://x/api/bff/performances?scope=PAST&page=2&size=20'));
    expect(res.status).toBe(200);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/performances');
    expect(url).toContain('scope=PAST');
    expect(url).toContain('page=2');
  });

  it('POST 등록은 본문을 BE로 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/performances/route');
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ title: '공연' }) }));
    expect(res.status).toBe(200);
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('PUT 단건 수정은 BE 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { PUT } = await import('@/app/api/bff/performances/[id]/route');
    await PUT(new Request('http://x', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ id: '7' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/performances/7');
  });

  it('DELETE 단건은 BE 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { DELETE } = await import('@/app/api/bff/performances/[id]/route');
    await DELETE(new Request('http://x', { method: 'DELETE' }), { params: Promise.resolve({ id: '7' }) });
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
    expect(String(f.mock.calls[0][0])).toContain('/api/performances/7');
  });

  it('포스터 PUT은 file 파트가 있으면 FormData로 BE 포스터 경로에 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 7, posterImageUrl: 'http://x/p.png' }, error: null }));
    vi.stubGlobal('fetch', f);
    const { PUT } = await import('@/app/api/bff/performances/[id]/poster/route');
    const fd = new FormData();
    fd.append('file', new Blob(['img'], { type: 'image/png' }), 'p.png');
    const res = await PUT(new Request('http://x', { method: 'PUT', body: fd }), { params: Promise.resolve({ id: '7' }) });
    expect(res.status).toBe(200);
    expect(String(f.mock.calls[0][0])).toContain('/api/performances/7/poster');
    expect((f.mock.calls[0][1] as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('포스터 PUT은 file 파트 없으면 400', async () => {
    const { PUT } = await import('@/app/api/bff/performances/[id]/poster/route');
    const res = await PUT(new Request('http://x', { method: 'PUT', body: new FormData() }), { params: Promise.resolve({ id: '7' }) });
    expect(res.status).toBe(400);
  });
});
