// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jar: Record<string, string> = {};
const cookieStore = {
  set: vi.fn((n: string, v: string) => { jar[n] = v; }),
  delete: vi.fn((n: string) => { delete jar[n]; }),
  get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
};
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

const OLD_ENV = { ...process.env };
beforeEach(() => {
  for (const k of Object.keys(jar)) delete jar[k];
  vi.clearAllMocks();
  process.env = { ...OLD_ENV, KAKAO_REDIRECT_URI: 'http://localhost:3000/api/bff/oauth/kakao/callback' };
});
afterEach(() => { process.env = { ...OLD_ENV }; vi.unstubAllGlobals(); });

function beJson(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
/**
 * Location 헤더를 **있는 그대로** 돌려준다.
 *
 * 예전에는 pathname+search 만 뽑아 비교해서, 호스트가 틀려도 통과했다.
 * 그 탓에 운영에서 `https://0.0.0.0:3000/feed` 로 리다이렉트하던 것을 놓쳤다
 * (2026-09-08 발견). 콜백은 전부 사이트 내부로 가므로 상대 경로여야 한다.
 */
function locationOf(res: Response) {
  return res.headers.get('location')!;
}

describe('GET /api/bff/oauth/kakao/callback', () => {
  it('state 통과 + BE 성공 → 인증 쿠키 설정 후 /feed', async () => {
    jar['oauth_state'] = 'S';
    vi.stubGlobal('fetch', vi.fn(async () => beJson(
      { success: true, data: { accessToken: 'A', refreshToken: 'R' }, error: null }, 200)));
    const { GET } = await import('@/app/api/bff/oauth/kakao/callback/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/callback?code=c&state=S'));

    expect(locationOf(res)).toBe('/feed');
    expect(jar['access_token']).toBe('A');
    expect(jar['refresh_token']).toBe('R');
    expect(jar['oauth_state']).toBeUndefined(); // 단일 사용
  });

  it('state 불일치 → /login?error=state, BE 미호출', async () => {
    jar['oauth_state'] = 'S';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/oauth/kakao/callback/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/callback?code=c&state=WRONG'));

    expect(locationOf(res)).toBe('/login?error=state');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jar['oauth_state']).toBeUndefined();
    expect(jar['access_token']).toBeUndefined();
  });

  it('카카오 error 파라미터 → /login?error=kakao_cancelled', async () => {
    jar['oauth_state'] = 'S';
    const { GET } = await import('@/app/api/bff/oauth/kakao/callback/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/callback?error=access_denied&state=S'));

    expect(locationOf(res)).toBe('/login?error=kakao_cancelled');
    expect(jar['oauth_state']).toBeUndefined();
  });

  it('state 통과했지만 code 없음 → /login?error=oauth, BE 미호출', async () => {
    jar['oauth_state'] = 'S';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/bff/oauth/kakao/callback/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/callback?state=S'));

    expect(locationOf(res)).toBe('/login?error=oauth');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(jar['oauth_state']).toBeUndefined();
    expect(jar['access_token']).toBeUndefined();
  });

  it('BE 교환 실패 → /login?error=oauth', async () => {
    jar['oauth_state'] = 'S';
    vi.stubGlobal('fetch', vi.fn(async () => beJson(
      { success: false, data: null, error: { resultCode: '502-01', code: 'OAUTH_PROVIDER_ERROR', message: '실패' } }, 502)));
    const { GET } = await import('@/app/api/bff/oauth/kakao/callback/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/callback?code=c&state=S'));

    expect(locationOf(res)).toBe('/login?error=oauth');
    expect(jar['access_token']).toBeUndefined();
    expect(jar['oauth_state']).toBeUndefined();
  });
});
