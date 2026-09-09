import { describe, it, expect, vi, beforeEach } from 'vitest';

// proxy.ts가 next/server를 import하므로 목으로 대체한다.
const redirect = vi.fn((url: URL) => ({ url }));
const next = vi.fn(() => ({ next: true }));
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => redirect(url),
    next: () => next(),
  },
}));

import { config, proxy } from '@/proxy';

type FakeRequest = Parameters<typeof proxy>[0];

function request(pathname: string, search = '', hasCookie = false): FakeRequest {
  return {
    cookies: { has: () => hasCookie },
    url: `http://localhost:3000${pathname}${search}`,
    nextUrl: { pathname, search },
  } as unknown as FakeRequest;
}

beforeEach(() => vi.clearAllMocks());

/** 통째로 로그인이 필요한 화면. 새 화면이 생기면 여기에도 추가한다. */
const PROTECTED_ROUTES = [
  '/profile',
  '/feed',
  '/recruitments',
  '/verified-performer',
  '/admin',
  '/chat',
];

/**
 * 공연은 **보기는 공개, 쓰기는 로그인**이다.
 *
 * 공개 API(`/api/public/performances`)가 이미 있는데 화면이 통째로 막혀 있어서,
 * 링크를 받은 사람이 공연을 하나도 볼 수 없었다(2026-09-09). 목록·상세를 열고
 * 등록·수정만 남긴다.
 */
const PROTECTED_PERFORMANCE_ROUTES = ['/performances/new', '/performances/:id/edit'];

describe('proxy matcher', () => {
  it('보호 대상 화면을 하나도 빠뜨리지 않는다', () => {
    for (const route of PROTECTED_ROUTES) {
      expect(config.matcher).toContain(`${route}/:path*`);
    }
  });

  it('공연은 등록·수정만 막고 목록·상세는 열어 둔다', () => {
    for (const route of PROTECTED_PERFORMANCE_ROUTES) {
      expect(config.matcher).toContain(route);
    }
    // 통째로 막는 패턴이 남아 있으면 목록·상세까지 다시 잠긴다.
    expect(config.matcher).not.toContain('/performances/:path*');
  });

  it('제거된 /dashboard는 포함하지 않는다', () => {
    expect(config.matcher.some((m) => m.startsWith('/dashboard'))).toBe(false);
  });

  it('보호 대상 외의 경로를 실수로 넣지 않는다', () => {
    expect(config.matcher).toHaveLength(
      PROTECTED_ROUTES.length + PROTECTED_PERFORMANCE_ROUTES.length);
  });

  it('공개 랜딩인 홈은 보호하지 않는다', () => {
    expect(config.matcher.some((m) => m === '/' || m === '/:path*')).toBe(false);
  });
});

describe('로그인 후 원래 경로로 되돌리기', () => {
  it('쿠키가 없으면 원래 경로를 next로 달아 로그인으로 보낸다', () => {
    proxy(request('/performances/12/edit'));

    const url = redirect.mock.calls[0][0];
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/performances/12/edit');
  });

  it('쿼리스트링까지 함께 보존한다', () => {
    proxy(request('/recruitments', '?scope=OPEN'));

    expect(redirect.mock.calls[0][0].searchParams.get('next')).toBe('/recruitments?scope=OPEN');
  });

  it('쿠키가 있으면 그대로 통과시킨다', () => {
    proxy(request('/feed', '', true));

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
