import { describe, it, expect } from 'vitest';
import {
  toRoomCursorPage, sortByIdAsc, mergeMessages, formatChatTime, formatChatDate, groupMessagesByDate,
  validateNewChat, toCreateDirectRequest,
} from '@/lib/chat/logic';
import type { ChatMessage } from '@/lib/chat/types';

function msg(id: number, createdAt = '2026-08-01T09:05:00'): ChatMessage {
  return { id, roomId: 1, sender: { id: 2, nickname: 'A', verified: false }, content: `m${id}`, createdAt };
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

describe('채팅 시각과 날짜', () => {
  it('KST LocalDateTime을 오전/오후 시각으로 표시한다', () => {
    expect(formatChatTime('2026-08-01T00:05:00')).toBe('오전 12:05');
    expect(formatChatTime('2026-08-01T13:05:30.123')).toBe('오후 1:05');
  });

  it('STOMP 나노초 LocalDateTime도 날짜와 시각으로 표시한다', () => {
    expect(formatChatTime('2026-09-29T12:19:07.131911043')).toBe('오후 12:19');
    expect(formatChatDate('2026-09-29T12:19:07.131911043')).toBe('2026년 9월 29일 화요일');
  });

  it('KST LocalDateTime을 날짜 라벨로 표시한다', () => {
    expect(formatChatDate('2026-08-01T09:05:00')).toBe('2026년 8월 1일 토요일');
  });

  it('날짜가 달라지면 별도 그룹으로 나눈다', () => {
    const groups = groupMessagesByDate([
      msg(1, '2026-08-01T23:59:00'),
      msg(2, '2026-08-02T00:01:00'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.messages.map((message) => message.id))).toEqual([[1], [2]]);
  });

  it('같은 날짜 메시지는 한 그룹으로 유지한다', () => {
    const groups = groupMessagesByDate([
      msg(1, '2026-08-01T09:05:00'),
      msg(2, '2026-08-01T18:05:00'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('2026년 8월 1일 토요일');
  });

  it('파싱할 수 없는 시각은 원문을 표시한다', () => {
    expect(formatChatTime('unknown')).toBe('unknown');
    expect(formatChatDate('unknown')).toBe('unknown');
  });
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
