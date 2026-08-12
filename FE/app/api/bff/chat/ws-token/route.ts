import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/server/cookies';

/**
 * STOMP CONNECT용 토큰 발급. httpOnly access 쿠키를 서버측에서 읽어 클라이언트에 반환한다.
 * BE로 프록시하지 않는 특수 라우트. 토큰이 WS 연결 동안 JS에 노출되는 트레이드오프를 감수한다.
 */
export async function GET() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, data: null, message: '로그인이 필요합니다.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, data: { token }, message: null });
}
