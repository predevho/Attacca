import { NextResponse, type NextRequest } from 'next/server';

// 쿠키 이름을 여기서 하드코딩하는 이유: lib/server/cookies.ts는 'server-only'라 edge 런타임인
// 미들웨어에서 import할 수 없다. 이름이 바뀌면 두 곳을 함께 고칠 것(access_token).
const ACCESS_COOKIE = 'access_token';

/**
 * 인증 필요 라우트 보호. access 쿠키의 '존재'만 검사한다(서명 검증은 BE가 실제 호출 시 수행).
 * 만료된 access여도 통과시키고, 데이터 호출 단계에서 reissue가 처리한다 —
 * FE에 JWT 시크릿을 두지 않기 위함. 어드민 라우트의 역할(ROLE_ADMIN) 확인은
 * 쿠키만으로 불가하므로 페이지 클라이언트에서 신원 조회로 2차 게이트한다.
 *
 * 로그인으로 보낼 때 원래 가려던 경로를 `next`로 넘긴다. 홈이 공개 랜딩이 되면서
 * "홈에서 공연 카드 클릭 → 로그인 → 원래 그 공연"이 주 동선이 됐기 때문이다.
 * (이전에는 로그인 후 항상 /feed로 떨어져 방금 보려던 것을 다시 찾아야 했다.)
 */
export function middleware(req: NextRequest) {
  const hasAccess = req.cookies.has(ACCESS_COOKIE);
  if (!hasAccess) {
    const loginUrl = new URL('/login', req.url);
    // 내부 경로만 넘긴다. origin을 포함한 절대 URL을 넣으면 열린 리다이렉트가 된다.
    loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/profile/:path*', '/feed/:path*', '/performances/:path*', '/recruitments/:path*',
    '/verified-performer/:path*', '/admin/:path*', '/chat/:path*',
  ],
};
