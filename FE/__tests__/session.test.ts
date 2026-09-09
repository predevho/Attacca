import { describe, it, expect, vi, afterEach } from 'vitest';
import { authedBeFetch } from '@/lib/server/session';
import { ACCESS_COOKIE, REFRESH_COOKIE, type CookieStore } from '@/lib/server/cookies';

afterEach(() => { vi.unstubAllGlobals(); });

function fakeStore(access: string | null, refresh: string | null): CookieStore & { jar: Record<string, string> } {
  const jar: Record<string, string> = {};
  if (access) jar[ACCESS_COOKIE] = access;
  if (refresh) jar[REFRESH_COOKIE] = refresh;
  return {
    jar,
    set: vi.fn((n: string, v: string) => { jar[n] = v; }),
    delete: vi.fn((n: string) => { delete jar[n]; }),
    get: (n: string) => (n in jar ? { value: jar[n] } : undefined),
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('authedBeFetch', () => {
  it('access가 유효하면 Bearer로 호출하고 결과를 반환한다', async () => {
    const store = fakeStore('good-access', 'refresh');
    const fetchMock = vi.fn(async (_url?: RequestInfo | URL, _init?: RequestInit) => json({ success: true, data: { hi: 1 }, error: null }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const res = await authedBeFetch(store, '/api/members/me/profile');

    expect(res.ok).toBe(true);
    const authHeader = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(authHeader.Authorization).toBe('Bearer good-access');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401이면 reissue 후 새 access로 1회 재시도한다', async () => {
    const store = fakeStore('expired', 'good-refresh');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ success: false, data: null, error: { resultCode: '401-04', code: 'EXPIRED_TOKEN', message: '만료' } }, 401))
      .mockResolvedValueOnce(json({ success: true, data: { accessToken: 'new-access', refreshToken: 'new-refresh' }, error: null }, 200)) // reissue
      .mockResolvedValueOnce(json({ success: true, data: { hi: 2 }, error: null }, 200));                    // retry
    vi.stubGlobal('fetch', fetchMock);

    const res = await authedBeFetch(store, '/api/members/me/profile');

    expect(res.ok).toBe(true);
    expect(store.jar[ACCESS_COOKIE]).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryHeader = (fetchMock.mock.calls[2][1] as RequestInit).headers as Record<string, string>;
    expect(retryHeader.Authorization).toBe('Bearer new-access');
  });

  it('reissue로 받은 refresh도 쿠키에 갱신한다', async () => {
    // BE가 로테이션을 하므로 옛 refresh는 즉시 무효다. 여기서 안 갱신하면
    // 다음 재발급에서 재사용으로 감지돼 전 기기가 로그아웃된다.
    const store = fakeStore('expired', 'old-refresh');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ success: false, data: null, error: { resultCode: '401-04', code: 'EXPIRED_TOKEN', message: '만료' } }, 401))
      .mockResolvedValueOnce(json({ success: true, data: { accessToken: 'new-access', refreshToken: 'new-refresh' }, error: null }, 200))
      .mockResolvedValueOnce(json({ success: true, data: { hi: 2 }, error: null }, 200));
    vi.stubGlobal('fetch', fetchMock);

    await authedBeFetch(store, '/api/members/me/profile');

    expect(store.jar[REFRESH_COOKIE]).toBe('new-refresh');
  });

  it('reissue 응답에 refresh가 없으면 실패로 보고 쿠키를 지운다', async () => {
    // 옛 계약(access만)을 돌려주는 서버와 붙으면, 옛 refresh를 그대로 두는 것보다
    // 재로그인시키는 편이 안전하다 — 그 refresh는 이미 무효일 수 있다.
    const store = fakeStore('expired', 'old-refresh');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ success: false, data: null, error: { resultCode: '401-04', code: 'EXPIRED_TOKEN', message: '만료' } }, 401))
      .mockResolvedValueOnce(json({ success: true, data: { accessToken: 'new-access' }, error: null }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const res = await authedBeFetch(store, '/api/members/me/profile');

    expect(res.status).toBe(401);
    expect(store.jar[ACCESS_COOKIE]).toBeUndefined();
    expect(store.jar[REFRESH_COOKIE]).toBeUndefined();
  });

  it('reissue도 실패하면 쿠키를 지우고 401을 반환한다', async () => {
    const store = fakeStore('expired', 'bad-refresh');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ success: false, data: null, error: { resultCode: '401-04', code: 'EXPIRED_TOKEN', message: '만료' } }, 401))
      .mockResolvedValueOnce(json({ success: false, data: null, error: { resultCode: '401-04', code: 'EXPIRED_TOKEN', message: '만료' } }, 401)); // reissue 실패
    vi.stubGlobal('fetch', fetchMock);

    const res = await authedBeFetch(store, '/api/members/me/profile');

    expect(res.status).toBe(401);
    expect(store.jar[ACCESS_COOKIE]).toBeUndefined();
    expect(store.jar[REFRESH_COOKIE]).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2); // 원요청 + reissue, 재시도 없음
  });

  it('access 쿠키가 없으면 401을 반환한다(호출 안 함)', async () => {
    const store = fakeStore(null, null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await authedBeFetch(store, '/api/members/me/profile');

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
