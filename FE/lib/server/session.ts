import 'server-only';
import { beFetch, type BeResult } from '@/lib/server/beClient';
import {
  ACCESS_COOKIE, REFRESH_COOKIE,
  setAuthCookies, clearAuthCookies, type CookieStore,
} from '@/lib/server/cookies';

const UNAUTHENTICATED: BeResult = { ok: false, status: 401, data: null, message: '로그인이 필요합니다.' };

function withBearer(init: RequestInit | undefined, access: string): RequestInit {
  return { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${access}` } };
}

/**
 * 인증이 필요한 BE 호출. access 쿠키로 호출하고, 401이면 refresh로 reissue한 뒤
 * 새 access를 쿠키에 갱신하고 원 요청을 정확히 1회 재시도한다.
 * reissue가 실패하면 쿠키를 삭제하고 401을 반환한다.
 */
export async function authedBeFetch(store: CookieStore, path: string, init?: RequestInit): Promise<BeResult> {
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) return UNAUTHENTICATED;

  const first = await beFetch(path, withBearer(init, access));
  if (first.status !== 401) return first;

  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    clearAuthCookies(store);
    return UNAUTHENTICATED;
  }

  const reissued = await beFetch('/api/auth/reissue', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refresh }),
  });
  // BE가 로테이션을 하므로 refresh도 함께 새로 온다. 옛 refresh는 그 즉시 무효라서
  // 쿠키를 둘 다 갱신해야 한다 — access만 갱신하면 다음 재발급에서 재사용으로 감지돼
  // 전 기기가 로그아웃된다(DOMAIN-COMMON-STATUTE §4.1).
  const tokens = reissued.ok
    ? (reissued.data as { accessToken?: string; refreshToken?: string })
    : undefined;
  if (!reissued.ok || !tokens?.accessToken || !tokens?.refreshToken) {
    clearAuthCookies(store);
    return UNAUTHENTICATED;
  }

  setAuthCookies(store, tokens.accessToken, tokens.refreshToken);
  return beFetch(path, withBearer(init, tokens.accessToken)); // 정확히 1회 재시도
}
