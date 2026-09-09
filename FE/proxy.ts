import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/server/cookies';

// 예전 middleware.ts는 edge 런타임이라 'server-only'인 cookies.ts를 import할 수 없어
// 쿠키 이름을 여기에 하드코딩해 두 곳이 어긋날 위험을 안고 있었다.
// proxy는 nodejs 런타임이라 그 제약이 사라져 정본을 그대로 쓴다.

/**
 * 인증 필요 라우트 보호. (Next 16에서 middleware 파일 규약이 deprecated되어 proxy로 옮겼다.
 * proxy는 nodejs 런타임 고정이며 runtime 설정을 받지 않는다.) access 쿠키의 '존재'만 검사한다(서명 검증은 BE가 실제 호출 시 수행).
 * 만료된 access여도 통과시키고, 데이터 호출 단계에서 reissue가 처리한다 —
 * FE에 JWT 시크릿을 두지 않기 위함. 어드민 라우트의 역할(ROLE_ADMIN) 확인은
 * 쿠키만으로 불가하므로 페이지 클라이언트에서 신원 조회로 2차 게이트한다.
 *
 * 로그인으로 보낼 때 원래 가려던 경로를 `next`로 넘긴다. 홈이 공개 랜딩이 되면서
 * "홈에서 공연 카드 클릭 → 로그인 → 원래 그 공연"이 주 동선이 됐기 때문이다.
 * (이전에는 로그인 후 항상 /feed로 떨어져 방금 보려던 것을 다시 찾아야 했다.)
 */
export function proxy(req: NextRequest) {
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
    '/profile/:path*', '/feed/:path*', '/recruitments/:path*',
    '/verified-performer/:path*', '/admin/:path*', '/chat/:path*',
    // 공연은 **보기는 공개, 쓰기는 로그인**이다. 공개 API가 이미 있는데 화면이
    // 통째로 막혀 있어서 링크를 받은 사람이 공연을 하나도 볼 수 없었다(2026-09-09).
    // 목록(/performances)과 상세(/performances/12)는 열고 등록·수정만 막는다.
    '/performances/new', '/performances/:id/edit',
  ],
};
