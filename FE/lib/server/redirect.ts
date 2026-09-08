import 'server-only';
import { NextResponse } from 'next/server';

/**
 * 우리 사이트 안으로 되돌려 보내는 리다이렉트. **상대 경로**로 보낸다.
 *
 * `NextResponse.redirect(new URL(path, request.url))` 를 쓰면 안 된다 —
 * 프록시 뒤 standalone Next에서 `request.url` 의 호스트는 컨테이너 자기 주소
 * (`0.0.0.0:3000`)라, 운영에서 브라우저가 `https://0.0.0.0:3000/login...` 으로
 * 튕겨 아무 데도 못 간다(2026-09-08 카카오 로그인에서 발견).
 * 미들웨어는 Edge 런타임이라 멀쩡했고 라우트 핸들러만 깨져 눈에 잘 안 띄었다.
 *
 * Host 헤더로 절대 주소를 만드는 것도 답이 아니다. 그 값은 클라이언트가 정하므로
 * 오픈 리다이렉트가 된다. 호스트를 아예 빼면 두 문제가 함께 사라진다
 * (상대 참조 Location은 RFC 7231이 허용하고 브라우저가 현재 주소 기준으로 해석한다).
 *
 * @param path 반드시 `/` 로 시작하는 사이트 내부 경로.
 */
export function redirectTo(path: string): NextResponse {
  if (!path.startsWith('/') || path.startsWith('//')) {
    // `//evil.com` 은 스킴 상대 URL이라 외부로 나간다. 내부 경로만 받는다.
    throw new Error(`내부 경로가 아니다: ${path}`);
  }
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
