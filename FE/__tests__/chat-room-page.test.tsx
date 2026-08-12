import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '3' }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

// stompClient 목: connect/subscribeRoom/send/disconnect 캡처. onMessage를 테스트가 트리거할 수 있게 보관.
let capturedOnMessage: ((m: unknown) => void) | null = null;
const send = vi.fn();
const disconnect = vi.fn();
const connect = vi.fn((h?: { onConnect?: () => void }) => { h?.onConnect?.(); });
const subscribeRoom = vi.fn((_id: number, onMessage: (m: unknown) => void) => { capturedOnMessage = onMessage; return () => {}; });
vi.mock('@/lib/chat/stompClient', () => ({
  createChatSocket: () => ({ connect, subscribeRoom, send, disconnect }),
}));

import ChatRoomPage from '@/app/chat/[id]/page';

const detail = { id: 3, type: 'DIRECT', title: null, participants: [{ id: 2, nickname: '홍길동', verified: false, online: true }], createdAt: '' };
const history = { items: [{ id: 10, roomId: 3, sender: { id: 2, nickname: '홍길동', verified: false }, content: '안녕', createdAt: '2026-08-01T09:00:00' }], nextCursor: null };

function mockOk(meId = 9) {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: meId, nickname: 'Me', role: 'USER', verified: false } });
    if (p === '/api/bff/chat/rooms/3') return Promise.resolve({ ok: true, data: detail });
    if (p.startsWith('/api/bff/chat/rooms/3/messages')) return Promise.resolve({ ok: true, data: history });
    return Promise.resolve({ ok: false, message: 'x' });
  });
}

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); postBff.mockReset();
  send.mockClear(); disconnect.mockClear(); connect.mockClear(); subscribeRoom.mockClear();
  capturedOnMessage = null;
  postBff.mockResolvedValue({ ok: true, data: null });
});

describe('ChatRoomPage', () => {
  it('이력 렌더 + 구독', async () => {
    mockOk();
    render(<ChatRoomPage />);
    expect(await screen.findByText('안녕')).toBeInTheDocument();
    expect(subscribeRoom).toHaveBeenCalledWith(3, expect.any(Function));
  });

  it('수신 메시지를 append', async () => {
    mockOk();
    render(<ChatRoomPage />);
    await screen.findByText('안녕');
    capturedOnMessage?.({ id: 11, roomId: 3, sender: { id: 2, nickname: '홍길동', verified: false }, content: '반가워', createdAt: '2026-08-01T09:06:00' });
    expect(await screen.findByText('반가워')).toBeInTheDocument();
  });

  it('전송 시 stompClient.send 호출', async () => {
    mockOk();
    render(<ChatRoomPage />);
    await screen.findByText('안녕');
    fireEvent.change(screen.getByLabelText('메시지 입력'), { target: { value: '테스트' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(send).toHaveBeenCalledWith(3, '테스트');
  });

  it('이력 로드 후 읽음 처리', async () => {
    mockOk();
    render(<ChatRoomPage />);
    await screen.findByText('안녕');
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/chat/rooms/3/read', { lastReadMessageId: 10 }));
  });

  it('DIRECT 헤더는 본인을 제외한 참여자만 표시', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: '나', role: 'USER', verified: false } });
      if (p === '/api/bff/chat/rooms/3') return Promise.resolve({ ok: true, data: { ...detail, participants: [
        { id: 2, nickname: '홍길동', verified: false, online: true },
        { id: 9, nickname: '나', verified: false, online: true },
      ] } });
      if (p.startsWith('/api/bff/chat/rooms/3/messages')) return Promise.resolve({ ok: true, data: history });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<ChatRoomPage />);
    const h = await screen.findByRole('heading', { level: 1 });
    expect(h).toHaveTextContent('홍길동');
    expect(h).not.toHaveTextContent('나');
  });

  it('상세 실패 시 안내', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'Me', role: 'USER', verified: false } });
      return Promise.resolve({ ok: false, message: 'not found' });
    });
    render(<ChatRoomPage />);
    expect(await screen.findByText('없거나 접근할 수 없는 방입니다.')).toBeInTheDocument();
  });
});
