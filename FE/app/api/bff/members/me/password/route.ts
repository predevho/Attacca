import { cookies } from 'next/headers';
import { authedBeFetch } from '@/lib/server/session';
import { setAuthCookies } from '@/lib/server/cookies';
import { bffResultJson } from '@/lib/server/bffProxy';

/**
 * 비밀번호 변경. (DOMAIN-MEMBER-STATUTE §3.5)
 *
 * BE가 다른 기기의 refresh 를 모두 끊고 **부른 본인에게만** 새 토큰 쌍을 준다.
 * 그 쌍을 쿠키에 갈아 끼우지 않으면, 방금 비밀번호를 바꾼 사람의 옛 refresh 가
 * 이미 철회돼 있어 다음 갱신에서 튕긴다.
 */
export async function PUT(request: Request) {
  const store = await cookies();
  const body = await request.text();
  const res = await authedBeFetch(store, '/api/members/me/password', { method: 'PUT', body });

  if (res.ok) {
    const { accessToken, refreshToken } = res.data as { accessToken: string; refreshToken: string };
    setAuthCookies(store, accessToken, refreshToken);
  }
  return bffResultJson(res);
}
