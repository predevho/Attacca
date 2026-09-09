import { describe, it, expect } from 'vitest';
import {
  toNoticeRequest,
  toFormValues,
  validateNotice,
  hasError,
  EMPTY_NOTICE_FORM,
} from '@/lib/notice/logic';
import type { AdminNotice, NoticeFormValues } from '@/lib/notice/types';

const filled: NoticeFormValues = {
  type: 'EVENT',
  title: '정기 점검',
  content: '새벽에 잠시 멈춥니다.',
  scheduledAt: '2026-10-01T03:00',
  place: '온라인',
  pinned: true,
};

describe('toNoticeRequest', () => {
  it('빈 칸은 null 로 보낸다', () => {
    // 빈 문자열을 그대로 보내면 "장소가 빈 문자열인 공지"가 생긴다.
    const r = toNoticeRequest({ ...EMPTY_NOTICE_FORM, title: '제목', content: '내용' });
    expect(r.scheduledAt).toBeNull();
    expect(r.place).toBeNull();
  });

  it('datetime-local 값에 초를 붙여 보낸다', () => {
    // BE는 LocalDateTime 이라 초가 필요하다. 화면 입력에는 초가 없다.
    expect(toNoticeRequest(filled).scheduledAt).toBe('2026-10-01T03:00:00');
  });

  it('앞뒤 공백은 다듬는다', () => {
    const r = toNoticeRequest({ ...filled, title: '  제목  ', place: '  홀  ' });
    expect(r.title).toBe('제목');
    expect(r.place).toBe('홀');
  });

  it('나머지는 그대로 넘긴다', () => {
    const r = toNoticeRequest(filled);
    expect(r.type).toBe('EVENT');
    expect(r.pinned).toBe(true);
  });
});

describe('toFormValues', () => {
  const notice: AdminNotice = {
    id: 1, type: 'NEWS', title: '소식', content: '본문',
    scheduledAt: '2026-10-01T03:00:00', place: '홀', pinned: false,
    coverImageUrl: null, createdAt: '2026-09-09T10:00:00', updatedAt: '2026-09-09T10:00:00',
  };

  it('수정 폼에 실을 수 있게 되돌린다', () => {
    const f = toFormValues(notice);
    expect(f.type).toBe('NEWS');
    // datetime-local 은 초를 받지 않는다. 그대로 넣으면 칸이 비어 보인다.
    expect(f.scheduledAt).toBe('2026-10-01T03:00');
    expect(f.place).toBe('홀');
  });

  it('null 은 빈 문자열로 되돌린다', () => {
    const f = toFormValues({ ...notice, scheduledAt: null, place: null });
    expect(f.scheduledAt).toBe('');
    expect(f.place).toBe('');
  });
});

describe('validateNotice', () => {
  it('올바른 입력은 통과한다', () => {
    expect(hasError(validateNotice(filled))).toBe(false);
  });

  it('제목과 본문은 비울 수 없다', () => {
    expect(validateNotice({ ...filled, title: '   ' }).title).toBeTruthy();
    expect(validateNotice({ ...filled, content: '' }).content).toBeTruthy();
  });

  it('BE 와 같은 길이 제한을 쓴다', () => {
    // 규칙이 갈리면 화면이 통과시킨 값을 서버가 거절한다.
    expect(validateNotice({ ...filled, title: 'ㄱ'.repeat(101) }).title).toBeTruthy();
    expect(validateNotice({ ...filled, content: 'ㄱ'.repeat(5001) }).content).toBeTruthy();
    expect(validateNotice({ ...filled, place: 'ㄱ'.repeat(201) }).place).toBeTruthy();
  });

  it('일정(EVENT)인데 일시가 없으면 알려 준다', () => {
    // 일시가 없으면 달력에 뜨지 않는다 — 일정으로 올린 뜻이 사라진다.
    expect(validateNotice({ ...filled, scheduledAt: '' }).scheduledAt).toBeTruthy();
    // 공지·뉴스는 일시가 없어도 된다.
    expect(validateNotice({ ...filled, type: 'NOTICE', scheduledAt: '' }).scheduledAt)
      .toBeUndefined();
  });
});
