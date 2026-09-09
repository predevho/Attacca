// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * BE에 닿지 못했을 때 BFF는 502로 답해야 한다.
 *
 * `beFetch`는 연결 실패를 `status: 0`으로 정규화하는데, 라우트들이 `res.status || 200`을
 * 쓰고 있어 **연결 실패가 HTTP 200으로 나갔다.** 지금 클라이언트는 바디의 `ok`로 판단해
 * 겉으로는 멀쩡했지만, status를 보는 소비처(프록시·모니터링·캐시)가 생기면 장애가 성공으로 집계된다.
 */

const jar: Record<string, string> = { access_token: 'A', refresh_token: 'R' };
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

const req = (method: string, body?: string) =>
  new Request('http://x/api/bff/thing', { method, ...(body ? { body } : {}) });

const ctx = { params: Promise.resolve({ id: '1' }) };

/** BE로 나가는 모든 요청이 실패하는 상황. */
function beUnreachable() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
}

const CASES: { name: string; run: () => Promise<Response> }[] = [
  { name: 'GET /me', run: async () => (await import('@/app/api/bff/me/route')).GET() },
  { name: 'PUT /me/profile', run: async () => (await import('@/app/api/bff/me/profile/route')).PUT(req('PUT', '{}')) },
  { name: 'PUT /me/profile/image', run: async () => {
      const form = new FormData();
      form.append('file', new Blob(['x'], { type: 'image/png' }), 'a.png');
      return (await import('@/app/api/bff/me/profile/image/route'))
        .PUT(new Request('http://x/api/bff/thing', { method: 'PUT', body: form }));
    } },
  { name: 'GET /profile-options', run: async () => (await import('@/app/api/bff/profile-options/route')).GET() },
  { name: 'POST /login', run: async () => (await import('@/app/api/bff/login/route')).POST(req('POST', '{}')) },
  { name: 'POST /signup', run: async () => (await import('@/app/api/bff/signup/route')).POST(req('POST', '{}')) },
  { name: 'DELETE /members/me', run: async () => (await import('@/app/api/bff/members/me/route')).DELETE() },
  { name: 'PUT /members/me/password', run: async () => (await import('@/app/api/bff/members/me/password/route')).PUT(req('PUT', '{}')) },
  { name: 'GET /admin/notices', run: async () => (await import('@/app/api/bff/admin/notices/route')).GET(req('GET')) },
  { name: 'POST /admin/notices', run: async () => (await import('@/app/api/bff/admin/notices/route')).POST(req('POST', '{}')) },
  { name: 'GET /admin/notices/[id]', run: async () => (await import('@/app/api/bff/admin/notices/[id]/route')).GET(req('GET'), ctx) },
  { name: 'PUT /admin/notices/[id]', run: async () => (await import('@/app/api/bff/admin/notices/[id]/route')).PUT(req('PUT', '{}'), ctx) },
  { name: 'DELETE /admin/notices/[id]', run: async () => (await import('@/app/api/bff/admin/notices/[id]/route')).DELETE(req('DELETE'), ctx) },
];

describe('BE 연결 실패 시 BFF status', () => {
  it.each(CASES)('$name 는 502로 답한다', async ({ run }) => {
    beUnreachable();
    const res = await run();
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
  });
});

/**
 * BFF 3계층 격리: 토큰은 httpOnly 쿠키로만 나가고 응답 바디에는 실리지 않는다.
 * 응답 생성을 헬퍼로 모으면서 실수로 `data`를 함께 싣기 쉬워졌으므로 여기서 못박는다.
 */
describe('토큰 격리', () => {
  it('로그인 응답 바디에 토큰이 없다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, data: { accessToken: 'AT', refreshToken: 'RT' }, error: null }),
      { status: 200, headers: { 'content-type': 'application/json' } })));
    const { POST } = await import('@/app/api/bff/login/route');
    const res = await POST(req('POST', '{}'));
    const text = await res.text();
    expect(text).not.toContain('AT');
    expect(text).not.toContain('accessToken');
    expect(JSON.parse(text).ok).toBe(true);
    expect(cookieStore.set).toHaveBeenCalled(); // 쿠키로는 나갔다
  });

  it('비밀번호 변경 응답 바디에도 토큰이 없다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: true, data: { accessToken: 'AT2', refreshToken: 'RT2' }, error: null }),
      { status: 200, headers: { 'content-type': 'application/json' } })));
    const { PUT } = await import('@/app/api/bff/members/me/password/route');
    const text = await (await PUT(req('PUT', '{}'))).text();
    expect(text).not.toContain('AT2');
  });
});

