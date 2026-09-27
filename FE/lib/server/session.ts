import 'server-only';
import { beFetch, type BeResult } from '@/lib/server/beClient';
import {
  ACCESS_COOKIE, REFRESH_COOKIE,
  setAccessCookie, clearAuthCookies, type CookieStore,
} from '@/lib/server/cookies';

const UNAUTHENTICATED: BeResult = { ok: false, status: 401, data: null, message: '로그인이 필요합니다.' };

function withBearer(init: RequestInit | undefined, access: string): RequestInit {
  return { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${access}` } };
}

/**
 * 인증이 필요한 BE 호출. access 쿠키로 호출하고, 401이면 로그인 세션으로 재발급한 뒤
 * 새 access를 쿠키에 갱신하고 원 요청을 정확히 1회 재시도한다.
 * reissue가 실패하면 쿠키를 삭제하고 401을 반환한다.
 */
export async function authedBeFetch(store: CookieStore, path: string, init?: RequestInit): Promise<BeResult> {
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) return UNAUTHENTICATED;

  const first = await beFetch(path, withBearer(init, access));
  if (first.status !== 401) return first;

  const refreshSession = store.get(REFRESH_COOKIE)?.value;
  if (!refreshSession) {
    clearAuthCookies(store);
    return UNAUTHENTICATED;
  }

  const reissued = await beFetch('/api/auth/reissue', {
    method: 'POST',
    body: JSON.stringify({ refreshSession }),
  });
  const tokens = reissued.ok
    ? (reissued.data as { accessToken?: string })
    : undefined;
  if (!reissued.ok || !tokens?.accessToken) {
    clearAuthCookies(store);
    return UNAUTHENTICATED;
  }

  setAccessCookie(store, tokens.accessToken);
  return beFetch(path, withBearer(init, tokens.accessToken)); // 정확히 1회 재시도
}
