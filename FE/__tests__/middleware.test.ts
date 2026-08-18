import { describe, it, expect, vi } from 'vitest';

// middleware.ts가 next/server를 import하므로 목으로 대체한다.
// 이 테스트는 config.matcher만 검증하며 미들웨어 본문은 실행하지 않는다.
vi.mock('next/server', () => ({
  NextResponse: { redirect: vi.fn(), next: vi.fn() },
}));

import { config } from '@/middleware';

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
});
