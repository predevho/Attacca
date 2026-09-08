import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authedBeFetch } from '@/lib/server/session';
import { clearAuthCookies } from '@/lib/server/cookies';

/**
 * 회원 탈퇴. 되돌릴 수 없다. (DOMAIN-MEMBER-STATUTE §3.5)
 *
 * BE가 refresh 를 모두 철회하므로 재발급은 막히지만, 이미 내려간 access 쿠키가
 * 브라우저에 남아 있으면 만료(30분)까지 로그인한 것처럼 보인다. 여기서 함께 지운다.
 */
export async function DELETE() {
  const store = await cookies();
  const res = await authedBeFetch(store, '/api/members/me', { method: 'DELETE' });
  if (res.ok) clearAuthCookies(store);
  return NextResponse.json({ ok: res.ok, message: res.message }, { status: res.status || 200 });
}
