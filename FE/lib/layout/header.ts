/** 헤더에 노출하는 화면. 순서가 곧 표시 순서다. 홈만 공개이고 나머지는 인증이 필요하다. */
export const NAV_ITEMS = [
  { href: '/', label: '홈' },
  { href: '/feed', label: '피드' },
  { href: '/performances', label: '공연' },
  { href: '/recruitments', label: '구인' },
  { href: '/chat', label: '채팅' },
] as const;

/** 헤더를 감출 화면(인증). 여기서 걸러 신원 조회 요청 자체를 보내지 않는다. */
const HIDDEN_PREFIXES = ['/login', '/signup'];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldShowHeader(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** 하위 경로(/feed/12)도 상위 링크(/feed)를 활성으로 본다. */
export function isActive(pathname: string, href: string): boolean {
  return matchesPrefix(pathname, href);
}
