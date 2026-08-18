import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, isActive, shouldShowHeader } from '@/lib/layout/header';

describe('shouldShowHeader', () => {
  it('인증 화면에서는 헤더를 숨긴다', () => {
    expect(shouldShowHeader('/login')).toBe(false);
    expect(shouldShowHeader('/signup')).toBe(false);
  });

  it('그 외 화면에서는 헤더를 보여준다', () => {
    expect(shouldShowHeader('/feed')).toBe(true);
    expect(shouldShowHeader('/feed/12')).toBe(true);
    expect(shouldShowHeader('/')).toBe(true);
  });

  it('경로 접두가 우연히 겹치는 것은 인증 화면으로 보지 않는다', () => {
    expect(shouldShowHeader('/loginsomething')).toBe(true);
  });
});

describe('isActive', () => {
  it('정확히 일치하면 활성이다', () => {
    expect(isActive('/feed', '/feed')).toBe(true);
  });

  it('하위 경로도 활성으로 본다', () => {
    expect(isActive('/feed/12', '/feed')).toBe(true);
    expect(isActive('/recruitments/3/edit', '/recruitments')).toBe(true);
  });

  it('다른 경로는 활성이 아니다', () => {
    expect(isActive('/performances', '/feed')).toBe(false);
  });
});

describe('NAV_ITEMS', () => {
  it('도메인 화면 4개를 담는다', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(['/feed', '/performances', '/recruitments', '/chat']);
  });
});
