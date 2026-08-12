import { describe, it, expect } from 'vitest';
import {
  toRoomCursorPage, sortByIdAsc, mergeMessages, formatTime, validateNewChat, toCreateDirectRequest,
} from '@/lib/chat/logic';
import type { ChatMessage } from '@/lib/chat/types';

function msg(id: number): ChatMessage {
  return { id, roomId: 1, sender: { id: 2, nickname: 'A', verified: false }, content: `m${id}`, createdAt: '2026-08-01T09:05:00' };
}

describe('toRoomCursorPage', () => {
  it('마지막 아니면 nextCursor=number+1', () =>
    expect(toRoomCursorPage({ content: [{ id: 1 } as never], number: 0, totalPages: 2, last: false }))
      .toEqual({ items: [{ id: 1 }], nextCursor: 1 }));
  it('마지막이면 null', () =>
    expect(toRoomCursorPage({ content: [], number: 1, totalPages: 2, last: true }))
      .toEqual({ items: [], nextCursor: null }));
});

describe('sortByIdAsc', () => {
  it('id 오름차순 정렬(원본 불변)', () => {
    const input = [msg(3), msg(1), msg(2)];
    expect(sortByIdAsc(input).map((m) => m.id)).toEqual([1, 2, 3]);
    expect(input.map((m) => m.id)).toEqual([3, 1, 2]);
  });
});

describe('mergeMessages', () => {
  it('중복 id 제거 후 오름차순', () => {
    expect(mergeMessages([msg(1), msg(2)], [msg(2), msg(3)]).map((m) => m.id)).toEqual([1, 2, 3]);
  });
  it('과거 메시지를 앞에 붙여도 정렬 유지', () => {
    expect(mergeMessages([msg(5)], [msg(3), msg(4)]).map((m) => m.id)).toEqual([3, 4, 5]);
  });
});

describe('formatTime', () => {
  it('ISO에서 HH:mm', () => expect(formatTime('2026-08-01T09:05:00')).toBe('09:05'));
});

describe('validateNewChat', () => {
  it('빈/0/음수 에러', () => {
    expect(validateNewChat({ memberId: '' })).toMatch(/회원/);
    expect(validateNewChat({ memberId: '0' })).toMatch(/회원/);
  });
  it('양의 정수면 null', () => expect(validateNewChat({ memberId: '7' })).toBeNull());
});

describe('toCreateDirectRequest', () => {
  it('DIRECT 요청 본문', () =>
    expect(toCreateDirectRequest({ memberId: '7' })).toEqual({ type: 'DIRECT', participantIds: [7] }));
});
