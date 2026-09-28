import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomListItem } from '@/components/chat/RoomListItem';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { ChatRoomHeader } from '@/components/chat/ChatRoomHeader';
import { ChatRoomTimeline } from '@/components/chat/ChatRoomTimeline';
import type { RoomDetail, RoomSummary, ChatMessage } from '@/lib/chat/types';

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
  it('방 전체를 접근 가능한 열기 버튼으로 제공', () => {
    const onOpen = vi.fn();
    render(<RoomListItem room={room} onOpen={onOpen} />);
    const openButton = screen.getByRole('button', { name: /홍길동/ });
    expect(openButton).toHaveAttribute('type', 'button');
    fireEvent.click(openButton);
    expect(onOpen).toHaveBeenCalled();
  });
});

// NewChatForm 은 회원 id 입력에서 닉네임 검색으로 바뀌었다 → __tests__/member-search.test.tsx

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
  it('긴 메시지는 단어 단위가 없어도 버블 안에서 줄바꿈', () => {
    render(<MessageBubble message={{ ...m, content: 'a'.repeat(200) }} mine />);
    expect(screen.getByText('a'.repeat(200))).toHaveClass('break-all');
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
  it('Enter 키로 전송', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const input = screen.getByLabelText('메시지 입력');
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('안녕');
  });
  it('한글 조합 중 Enter는 전송하지 않는다', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const input = screen.getByLabelText('메시지 입력');
    fireEvent.change(input, { target: { value: '중복' } });

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
  });
  it('disabled면 전송 버튼 비활성 + onSend 미호출', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} disabled />);
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(onSend).not.toHaveBeenCalled();
  });
  it('모바일 하단 safe-area를 확보', () => {
    render(<MessageComposer onSend={() => {}} />);
    expect(screen.getByRole('contentinfo')).toHaveClass('pb-[env(safe-area-inset-bottom)]');
  });
});

const directRoom: RoomDetail = {
  id: 1,
  type: 'DIRECT',
  title: null,
  participants: [
    { id: 2, nickname: '홍길동', verified: false, online: true },
    { id: 9, nickname: '나', verified: false, online: true },
  ],
  createdAt: '',
};

describe('ChatRoomHeader', () => {
  it('DIRECT 방에서는 내 이름을 제외한 상대 이름만 표시한다', () => {
    render(<ChatRoomHeader room={directRoom} me={{ id: 9, nickname: '나', role: 'USER', verified: false }} onBack={() => {}} onToggleInvite={() => {}} onLeave={() => {}} />);
    expect(screen.getByRole('heading')).toHaveTextContent('홍길동');
    expect(screen.getByRole('heading')).not.toHaveTextContent('나');
    expect(screen.queryByRole('button', { name: '초대' })).not.toBeInTheDocument();
  });

  it('GROUP 방에서는 참여자와 초대·나가기 조작을 표시한다', () => {
    const onToggleInvite = vi.fn();
    const onLeave = vi.fn();
    render(<ChatRoomHeader room={{ ...directRoom, type: 'GROUP', title: '합주' }} me={{ id: 9, nickname: '나', role: 'USER', verified: false }} onBack={() => {}} onToggleInvite={onToggleInvite} onLeave={onLeave} />);
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    expect(screen.getByRole('group', { name: '참여자' })).toHaveTextContent('나 (나)');
    expect(onToggleInvite).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });
});

describe('ChatRoomTimeline', () => {
  it('이전 이력 버튼과 메시지 목록을 렌더링한다', () => {
    const onLoadOlder = vi.fn();
    render(<ChatRoomTimeline scrollRef={{ current: null }} messages={[{ id: 1, roomId: 1, sender: { id: 2, nickname: '홍길동', verified: false }, content: '안녕', createdAt: '2026-08-01T09:00:00' }]} viewerId={9} olderCursor={1} loadingOlder={false} onLoadOlder={onLoadOlder} />);
    fireEvent.click(screen.getByRole('button', { name: '이전 메시지 더 보기' }));
    expect(onLoadOlder).toHaveBeenCalledOnce();
    expect(screen.getByText('안녕')).toBeInTheDocument();
  });
});
