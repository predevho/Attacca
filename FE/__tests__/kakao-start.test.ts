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
afterEach(() => { process.env = { ...OLD_ENV }; });

/**
 * Location 헤더를 **있는 그대로** 돌려준다.
 *
 * 예전에는 여기서 `new URL(...)` 로 파싱해 pathname+search 만 비교했다.
 * 그래서 호스트가 틀려도 테스트가 통과했고, 운영에서 라우트 핸들러가
 * `https://0.0.0.0:3000/login...` 으로 리다이렉트하는 것을 놓쳤다
 * (2026-09-08 발견). 호스트를 버리지 않는다.
 */
function locationOf(res: Response) {
  return res.headers.get('location')!;
}

describe('GET /api/bff/oauth/kakao/start', () => {
  it('KAKAO_CLIENT_ID 없으면 state 없이 /login?error=oauth_config로 리다이렉트', async () => {
    delete process.env.KAKAO_CLIENT_ID;
    const { GET } = await import('@/app/api/bff/oauth/kakao/start/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/start'));

    // 상대 경로여야 한다 — 호스트가 붙으면 컨테이너 주소로 새거나,
    // Host 헤더를 믿게 되어 오픈 리다이렉트가 된다.
    expect(locationOf(res)).toBe('/login?error=oauth_config');
    expect(jar['oauth_state']).toBeUndefined();
  });

  it('KAKAO_CLIENT_ID 있으면 state 쿠키 설정 후 카카오 authorize URL로 리다이렉트', async () => {
    process.env.KAKAO_CLIENT_ID = 'rest-key';
    const { GET } = await import('@/app/api/bff/oauth/kakao/start/route');

    const res = await GET(new Request('http://localhost:3000/api/bff/oauth/kakao/start'));

    // 카카오로 나가는 것은 외부 절대 주소가 맞다.
    const u = new URL(locationOf(res));
    expect(u.origin + u.pathname).toBe('https://kauth.kakao.com/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('rest-key');
    expect(u.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/bff/oauth/kakao/callback');
    expect(u.searchParams.get('response_type')).toBe('code');

    // authorize URL의 state가 쿠키에 저장된 값과 일치해야 한다(콜백 대조의 근거)
    const savedState = jar['oauth_state'];
    expect(savedState).toBeTruthy();
    expect(u.searchParams.get('state')).toBe(savedState);
  });
});
