import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomListItem } from '@/components/chat/RoomListItem';
import { NewChatForm } from '@/components/chat/NewChatForm';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageComposer } from '@/components/chat/MessageComposer';
import type { RoomSummary, ChatMessage } from '@/lib/chat/types';

const room: RoomSummary = {
  id: 1, type: 'DIRECT', displayName: '홍길동',
  lastMessage: { content: '안녕하세요', senderId: 2, createdAt: '2026-08-01T09:05:00' },
  unreadCount: 3, lastMessageAt: '2026-08-01T09:05:00',
};

describe('RoomListItem', () => {
  it('상대 이름·마지막 메시지·안읽은 배지', () => {
    render(<RoomListItem room={room} onOpen={() => {}} />);
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('안녕하세요')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
  it('안읽음 0이면 배지 없음', () => {
    render(<RoomListItem room={{ ...room, unreadCount: 0 }} onOpen={() => {}} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
  it('클릭 시 onOpen', () => {
    const onOpen = vi.fn();
    render(<RoomListItem room={room} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('홍길동'));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('NewChatForm', () => {
  it('빈 id면 onStart 미호출 + 에러', () => {
    const onStart = vi.fn();
    render(<NewChatForm submitting={false} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/회원/)).toBeInTheDocument();
  });
  it('유효 입력이면 onStart(values)', () => {
    const onStart = vi.fn();
    render(<NewChatForm submitting={false} onStart={onStart} />);
    fireEvent.change(screen.getByLabelText('회원 id'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(onStart).toHaveBeenCalledWith({ memberId: '7' });
  });
});

describe('MessageBubble', () => {
  const m: ChatMessage = { id: 1, roomId: 1, sender: { id: 2, nickname: '홍길동', verified: false }, content: '안녕', createdAt: '2026-08-01T09:05:00' };
  it('상대 메시지는 발신자 이름 표시', () => {
    render(<MessageBubble message={m} mine={false} />);
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('안녕')).toBeInTheDocument();
  });
  it('내 메시지는 발신자 이름 생략', () => {
    render(<MessageBubble message={m} mine={true} />);
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
    expect(screen.getByText('안녕')).toBeInTheDocument();
  });
});

describe('MessageComposer', () => {
  it('빈 값은 전송 안 함', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(onSend).not.toHaveBeenCalled();
  });
  it('입력 후 전송 시 onSend(content) + 입력 비움', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const input = screen.getByLabelText('메시지 입력') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(onSend).toHaveBeenCalledWith('안녕');
    expect(input.value).toBe('');
  });
});
