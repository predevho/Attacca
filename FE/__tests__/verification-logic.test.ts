import { describe, it, expect } from 'vitest';
import {
  toCursorPage, validateApply, validateReason, validateGrant,
  statusLabel, canReapply, toApplyRequest, toGrantRequest, isHttpUrl,
} from '@/lib/verification/logic';
import type { ApplyFormValues } from '@/lib/verification/types';

const base: ApplyFormValues = { statement: '오케스트라 5년 활동했습니다', evidenceUrls: [] };

describe('toCursorPage', () => {
  it('마지막 아니면 nextCursor=number+1', () =>
    expect(toCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 2, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 }));
  it('마지막이면 null', () =>
    expect(toCursorPage({ content: [], number: 1, totalPages: 2, last: true }))
      .toEqual({ items: [], nextCursor: null }));
});

describe('validateApply', () => {
  it('유효하면 null', () => expect(validateApply(base)).toBeNull());
  it('사유 없으면 에러', () => expect(validateApply({ ...base, statement: '  ' })).toMatch(/사유/));
  it('사유 1000자 초과 에러', () => expect(validateApply({ ...base, statement: 'a'.repeat(1001) })).toMatch(/1000자/));
  it('링크 11개(빈 값 제외) 초과 에러', () =>
    expect(validateApply({ ...base, evidenceUrls: Array(11).fill('http://x') })).toMatch(/10개/));
  it('빈 링크는 개수에서 제외', () =>
    expect(validateApply({ ...base, evidenceUrls: ['http://x', '', '  '] })).toBeNull());
  it('http(s) 아닌 링크는 에러', () =>
    expect(validateApply({ ...base, evidenceUrls: ['javascript:alert(1)'] })).toMatch(/http/));
  it('https 링크는 통과', () =>
    expect(validateApply({ ...base, evidenceUrls: ['https://a.com'] })).toBeNull());
});

describe('isHttpUrl', () => {
  it('http/https만 true', () => {
    expect(isHttpUrl('http://a')).toBe(true);
    expect(isHttpUrl('https://a')).toBe(true);
    expect(isHttpUrl(' https://a ')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('ftp://a')).toBe(false);
    expect(isHttpUrl('a.com')).toBe(false);
  });
});

describe('validateReason', () => {
  it('사유 없으면 에러', () => expect(validateReason('  ')).toMatch(/사유/));
  it('500자 초과 에러', () => expect(validateReason('a'.repeat(501))).toMatch(/500자/));
  it('유효하면 null', () => expect(validateReason('증빙 부족')).toBeNull());
});

describe('validateGrant', () => {
  it('빈 id 에러', () => expect(validateGrant({ memberId: '', reason: '' })).toMatch(/회원/));
  it('0/음수 에러', () => expect(validateGrant({ memberId: '0', reason: '' })).toMatch(/회원/));
  it('정수면 null', () => expect(validateGrant({ memberId: '5', reason: '' })).toBeNull());
});

describe('statusLabel', () => {
  it('PENDING→심사 중', () => expect(statusLabel('PENDING')).toBe('심사 중'));
  it('APPROVED→승인됨', () => expect(statusLabel('APPROVED')).toBe('승인됨'));
});

describe('canReapply', () => {
  it('REJECTED/REVOKED만 true', () => {
    expect(canReapply('REJECTED')).toBe(true);
    expect(canReapply('REVOKED')).toBe(true);
    expect(canReapply('PENDING')).toBe(false);
    expect(canReapply('APPROVED')).toBe(false);
  });
});

describe('toApplyRequest', () => {
  it('빈/공백 링크 제거 + trim', () =>
    expect(toApplyRequest({ statement: 's', evidenceUrls: [' http://a ', '', '  '] }))
      .toEqual({ statement: 's', evidenceUrls: ['http://a'] }));
});

describe('toGrantRequest', () => {
  it('memberId 숫자화, 빈 reason은 null', () =>
    expect(toGrantRequest({ memberId: '7', reason: '  ' })).toEqual({ memberId: 7, reason: null }));
  it('reason 있으면 그대로', () =>
    expect(toGrantRequest({ memberId: '7', reason: '수상 이력' })).toEqual({ memberId: 7, reason: '수상 이력' }));
});
