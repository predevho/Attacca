import { cookies } from 'next/headers';
import { authedBeFetch } from '@/lib/server/session';
import { setAuthCookies } from '@/lib/server/cookies';
import { bffResultJson } from '@/lib/server/bffProxy';

/**
 * 비밀번호 변경. (DOMAIN-MEMBER-STATUTE §3.5)
 *
 * BE가 기존 로그인 세션을 모두 철회한 뒤, 현재 요청자에게만 새 세션을 발급한다.
 */
export async function PUT(request: Request) {
  const store = await cookies();
  const body = await request.text();
  const res = await authedBeFetch(store, '/api/members/me/password', { method: 'PUT', body });

  if (res.ok) {
    const { accessToken, refreshSession } = res.data as { accessToken: string; refreshSession: string };
    setAuthCookies(store, accessToken, refreshSession);
  }
  return bffResultJson(res);
}
