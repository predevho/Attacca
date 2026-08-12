// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jar: Record<string, string> = { access_token: 'A' };
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));
beforeEach(() => { vi.clearAllMocks(); jar.access_token = 'A'; });
afterEach(() => vi.unstubAllGlobals());

function beJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const okFetch = () => vi.fn(async () => beJson({ success: true, data: null, error: null }));

describe('BFF 채팅 라우트', () => {
  it('GET 방 목록은 page 쿼리 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { content: [], number: 0, totalPages: 0, last: true }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/chat/rooms/route');
    await GET(new Request('http://x/api/bff/chat/rooms?page=1'));
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/chat/rooms');
    expect(url).toContain('page=1');
  });

  it('POST 방 생성은 본문 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { id: 3 }, error: null }));
    vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/chat/rooms/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ type: 'DIRECT', participantIds: [7] }) }));
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(String(f.mock.calls[0][0])).toContain('/api/chat/rooms');
  });

  it('GET 상세는 단건 경로', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/chat/rooms/[id]/route');
    await GET(new Request('http://x'), { params: Promise.resolve({ id: '3' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/chat/rooms/3');
  });

  it('GET 이력은 cursor/size 쿼리 전달', async () => {
    const f = vi.fn(async () => beJson({ success: true, data: { items: [], nextCursor: null }, error: null }));
    vi.stubGlobal('fetch', f);
    const { GET } = await import('@/app/api/bff/chat/rooms/[id]/messages/route');
    await GET(new Request('http://x/api/bff/chat/rooms/3/messages?cursor=10&size=20'), { params: Promise.resolve({ id: '3' }) });
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain('/api/chat/rooms/3/messages');
    expect(url).toContain('cursor=10');
  });

  it('POST 읽음은 본문 전달', async () => {
    const f = okFetch(); vi.stubGlobal('fetch', f);
    const { POST } = await import('@/app/api/bff/chat/rooms/[id]/read/route');
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ lastReadMessageId: 9 }) }), { params: Promise.resolve({ id: '3' }) });
    expect(String(f.mock.calls[0][0])).toContain('/api/chat/rooms/3/read');
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('ws-token은 access 쿠키가 있으면 토큰 반환', async () => {
    const { GET } = await import('@/app/api/bff/chat/ws-token/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, data: { token: 'A' }, message: null });
  });

  it('ws-token은 쿠키 없으면 401', async () => {
    delete jar.access_token;
    const { GET } = await import('@/app/api/bff/chat/ws-token/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
