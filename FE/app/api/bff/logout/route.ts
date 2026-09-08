import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { beFetch } from '@/lib/server/beClient';
import { REFRESH_COOKIE, clearAuthCookies } from '@/lib/server/cookies';

/**
 * 로그아웃. 쿠키를 지우기 전에 BE에 refresh 철회를 알린다.
 *
 * 예전에는 쿠키만 지웠고, 그래서 탈취된 refresh가 만료(14일)까지 그대로 유효했다.
 * 이제 BE가 화이트리스트에서 빼므로 그 토큰은 즉시 못 쓴다(DOMAIN-COMMON-STATUTE §4.1).
 *
 * BE 호출이 실패해도 쿠키는 지운다 — 사용자 입장에서 로그아웃은 언제나 성공해야 한다.
 */
export async function POST() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;

  if (refresh) {
    await beFetch('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: refresh }),
    });
  }

  clearAuthCookies(store);
  return NextResponse.json({ ok: true, message: null });
}
