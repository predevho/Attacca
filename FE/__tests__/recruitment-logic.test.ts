import { describe, it, expect } from 'vitest';
import {
  toCursorPage, validatePosting, formatDeadline, applicationStatusLabel, toPostingRequest, toFormValues,
} from '@/lib/recruitment/logic';
import type { PostingFormValues, Posting } from '@/lib/recruitment/types';

const base: PostingFormValues = {
  title: '피아노 반주자 구합니다', description: '', instruments: ['PIANO'],
  recruitCount: '2', location: '서울', fee: '협의', deadline: '',
};

describe('toCursorPage', () => {
  it('마지막 아니면 nextCursor=number+1', () =>
    expect(toCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 2, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 }));
  it('마지막이면 null', () =>
    expect(toCursorPage({ content: [], number: 1, totalPages: 2, last: true }))
      .toEqual({ items: [], nextCursor: null }));
});

describe('validatePosting', () => {
  it('유효하면 null', () => expect(validatePosting(base)).toBeNull());
  it('제목 없으면 에러', () => expect(validatePosting({ ...base, title: '  ' })).toMatch(/제목/));
  it('악기 0개면 에러', () => expect(validatePosting({ ...base, instruments: [] })).toMatch(/파트/));
  it('제목 100자 초과 에러', () => expect(validatePosting({ ...base, title: 'a'.repeat(101) })).toMatch(/100자/));
  it('모집 인원 0이면 에러', () => expect(validatePosting({ ...base, recruitCount: '0' })).toMatch(/인원/));
  it('모집 인원 빈 값은 허용(선택)', () => expect(validatePosting({ ...base, recruitCount: '' })).toBeNull());
});

describe('formatDeadline', () => {
  it('null이면 상시모집', () => expect(formatDeadline(null)).toBe('상시모집'));
  it('값 있으면 YYYY.MM.DD', () => expect(formatDeadline('2026-09-01T19:30:00')).toBe('2026.09.01'));
});

describe('applicationStatusLabel', () => {
  it('PENDING→대기 중', () => expect(applicationStatusLabel('PENDING')).toBe('대기 중'));
  it('ACCEPTED→수락됨', () => expect(applicationStatusLabel('ACCEPTED')).toBe('수락됨'));
});

describe('toPostingRequest', () => {
  it('빈 값은 null, 인원은 숫자, deadline 빈 값은 null', () => {
    expect(toPostingRequest({ ...base, description: '', location: '', fee: '', recruitCount: '', deadline: '' }))
      .toEqual({ title: base.title, description: null, instruments: ['PIANO'], recruitCount: null, location: null, fee: null, deadline: null });
  });
  it('deadline 값은 그대로 전달', () =>
    expect(toPostingRequest({ ...base, deadline: '2026-09-01T19:30' }).deadline).toBe('2026-09-01T19:30'));
});

describe('toFormValues', () => {
  it('Posting을 폼 값으로(널→빈문자열, deadline 16자 슬라이스)', () => {
    const p = { title: 'T', description: null, instruments: ['VIOLIN'], recruitCount: null,
      location: null, fee: null, deadline: '2026-09-01T19:30:00' } as Posting;
    expect(toFormValues(p)).toEqual({ title: 'T', description: '', instruments: ['VIOLIN'],
      recruitCount: '', location: '', fee: '', deadline: '2026-09-01T19:30' });
  });
});
