import { describe, it, expect } from 'vitest';
import { toCursorPage, validatePerformance, formatDateTime } from '@/lib/performance/logic';
import type { PerformanceFormValues } from '@/lib/performance/types';

const base: PerformanceFormValues = {
  title: '공연', description: '', performedAt: '2026-09-01T19:30', venue: '홀', program: '', ticketInfo: '', ticketUrl: '',
};

describe('toCursorPage', () => {
  it('마지막 페이지가 아니면 nextCursor=number+1', () => {
    expect(toCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 3, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 });
  });
  it('마지막 페이지면 nextCursor=null', () => {
    expect(toCursorPage({ content: [], number: 2, totalPages: 3, last: true }))
      .toEqual({ items: [], nextCursor: null });
  });
});

describe('validatePerformance', () => {
  it('유효하면 null', () => expect(validatePerformance(base)).toBeNull());
  it('공연명 없으면 에러', () => expect(validatePerformance({ ...base, title: '  ' })).toMatch(/공연명/));
  it('장소 없으면 에러', () => expect(validatePerformance({ ...base, venue: '' })).toMatch(/장소/));
  it('일시 없으면 에러', () => expect(validatePerformance({ ...base, performedAt: '' })).toMatch(/일시/));
  it('공연명 100자 초과 에러', () => expect(validatePerformance({ ...base, title: 'a'.repeat(101) })).toMatch(/100자/));
  it('링크 500자 초과 에러', () => expect(validatePerformance({ ...base, ticketUrl: 'a'.repeat(501) })).toMatch(/500자/));
});

describe('formatDateTime', () => {
  it('ISO LocalDateTime을 YYYY.MM.DD HH:mm로', () => {
    expect(formatDateTime('2026-09-01T19:30:00')).toBe('2026.09.01 19:30');
  });
  it('초 없는 값도 처리', () => expect(formatDateTime('2026-09-01T19:30')).toBe('2026.09.01 19:30'));
});
