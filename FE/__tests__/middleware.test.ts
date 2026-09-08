import { describe, it, expect, vi, beforeEach } from 'vitest';

// middleware.ts가 next/server를 import하므로 목으로 대체한다.
const redirect = vi.fn((url: URL) => ({ url }));
const next = vi.fn(() => ({ next: true }));
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => redirect(url),
    next: () => next(),
  },
}));

import { config, middleware } from '@/middleware';

type FakeRequest = Parameters<typeof middleware>[0];

function request(pathname: string, search = '', hasCookie = false): FakeRequest {
  return {
    cookies: { has: () => hasCookie },
    url: `http://localhost:3000${pathname}${search}`,
    nextUrl: { pathname, search },
  } as unknown as FakeRequest;
}

beforeEach(() => vi.clearAllMocks());

/** 인증이 필요한 모든 도메인 화면. 새 화면이 생기면 여기에도 추가한다. */
const PROTECTED_ROUTES = [
  '/profile',
  '/feed',
  '/performances',
  '/recruitments',
  '/verified-performer',
  '/admin',
  '/chat',
];

describe('middleware matcher', () => {
  it('보호 대상 화면을 하나도 빠뜨리지 않는다', () => {
    for (const route of PROTECTED_ROUTES) {
      expect(config.matcher).toContain(`${route}/:path*`);
    }
  });

  it('제거된 /dashboard는 포함하지 않는다', () => {
    expect(config.matcher.some((m) => m.startsWith('/dashboard'))).toBe(false);
  });

  it('보호 대상 외의 경로를 실수로 넣지 않는다', () => {
    expect(config.matcher).toHaveLength(PROTECTED_ROUTES.length);
  });

  it('공개 랜딩인 홈은 보호하지 않는다', () => {
    expect(config.matcher.some((m) => m === '/' || m === '/:path*')).toBe(false);
  });
});

describe('로그인 후 원래 경로로 되돌리기', () => {
  it('쿠키가 없으면 원래 경로를 next로 달아 로그인으로 보낸다', () => {
    middleware(request('/performances/12'));

    const url = redirect.mock.calls[0][0];
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/performances/12');
  });

  it('쿼리스트링까지 함께 보존한다', () => {
    middleware(request('/recruitments', '?scope=OPEN'));

    expect(redirect.mock.calls[0][0].searchParams.get('next')).toBe('/recruitments?scope=OPEN');
  });

  it('쿠키가 있으면 그대로 통과시킨다', () => {
    middleware(request('/feed', '', true));

    expect(redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
