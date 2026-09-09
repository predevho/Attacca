import { describe, it, expect } from 'vitest';
import { mergeMessages, shouldStickToBottom, prependOlder } from '@/lib/chat/logic';
import type { ChatMessage } from '@/lib/chat/types';

const msg = (id: number): ChatMessage => ({
  id, roomId: 1, sender: { id: 2, nickname: 'A', verified: false },
  content: `m${id}`, createdAt: '2026-09-09T10:00:00',
});

describe('이전 메시지 붙이기', () => {
  it('과거 메시지를 앞에 붙이고 id 오름차순을 지킨다', () => {
    // BE는 최신→과거로 주므로 그대로 붙이면 순서가 뒤집힌다.
    const current = [msg(10), msg(11)];
    const older = [msg(9), msg(8), msg(7)];
    expect(prependOlder(current, older).map((m) => m.id)).toEqual([7, 8, 9, 10, 11]);
  });

  it('겹치는 메시지는 한 번만 남는다', () => {
    // 커서 경계에서 같은 메시지가 두 번 올 수 있다.
    const current = [msg(9), msg(10)];
    const older = [msg(8), msg(9)];
    expect(prependOlder(current, older).map((m) => m.id)).toEqual([8, 9, 10]);
  });

  it('빈 응답은 목록을 바꾸지 않는다', () => {
    const current = [msg(1)];
    expect(prependOlder(current, [])).toEqual(current);
  });
});

describe('새 메시지 도착 시 스크롤', () => {
  it('바닥에 있으면 따라 내려간다', () => {
    expect(shouldStickToBottom({ scrollTop: 900, clientHeight: 100, scrollHeight: 1000 })).toBe(true);
  });

  it('살짝 올라가 있어도 바닥으로 본다', () => {
    // 스크롤이 픽셀 단위로 딱 떨어지지 않으므로 여유를 둔다.
    expect(shouldStickToBottom({ scrollTop: 860, clientHeight: 100, scrollHeight: 1000 })).toBe(true);
  });

  it('이전 대화를 읽고 있으면 끌어내리지 않는다', () => {
    // 읽는 중에 화면이 튀면 방해가 된다.
    expect(shouldStickToBottom({ scrollTop: 200, clientHeight: 100, scrollHeight: 1000 })).toBe(false);
  });

  it('내용이 화면보다 짧으면 항상 바닥이다', () => {
    expect(shouldStickToBottom({ scrollTop: 0, clientHeight: 500, scrollHeight: 300 })).toBe(true);
  });
});

describe('mergeMessages(기존)', () => {
  it('새 메시지를 뒤에 붙인다', () => {
    expect(mergeMessages([msg(1)], [msg(2)]).map((m) => m.id)).toEqual([1, 2]);
  });
});
