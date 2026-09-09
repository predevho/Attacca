import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '3' }) }));

const getBff = vi.fn(); const postBff = vi.fn(); const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (p: string) => getBff(p),
  postBff: (p: string, b?: unknown) => postBff(p, b),
  deleteBff: (p: string) => deleteBff(p),
}));

// STOMP는 이 테스트의 관심사가 아니다(연결 배선은 chat-stomp-client 테스트가 덮는다).
vi.mock('@/lib/chat/stompClient', () => ({
  createChatSocket: () => ({
    connect: () => {}, disconnect: () => {},
    subscribeRoom: () => () => {}, send: () => {},
  }),
}));

import ChatRoomPage from '@/app/chat/[id]/page';

const me = { id: 1, nickname: '나', role: 'USER', verified: false };
const groupRoom = {
  id: 3, type: 'GROUP', title: '가을 연주회 팀',
  participants: [
    { id: 1, nickname: '나', verified: false, online: true },
    { id: 7, nickname: '정하윤', verified: true, online: false },
  ],
  createdAt: '',
};
const directRoom = { ...groupRoom, type: 'DIRECT', title: null };

function mockRoom(room: unknown) {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: me });
    if (p === '/api/bff/chat/rooms/3') return Promise.resolve({ ok: true, data: room });
    if (p.includes('/messages')) return Promise.resolve({ ok: true, data: { items: [], nextCursor: null } });
    if (p.startsWith('/api/bff/members/search')) {
      return Promise.resolve({ ok: true, data: [{ id: 9, nickname: '김첼로', verified: false }] });
    }
    return Promise.resolve({ ok: false, message: 'x' });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  push.mockReset(); getBff.mockReset(); postBff.mockReset(); deleteBff.mockReset();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('그룹 대화창', () => {
  it('참여자를 보여준다', async () => {
    mockRoom(groupRoom);
    render(<ChatRoomPage />);
    const panel = await screen.findByRole('group', { name: '참여자' });
    expect(within(panel).getByText('정하윤')).toBeInTheDocument();
  });

  it('초대로 회원을 찾아 넣는다', async () => {
    mockRoom(groupRoom);
    postBff.mockResolvedValue({ ok: true, data: groupRoom });
    render(<ChatRoomPage />);

    fireEvent.click(await screen.findByRole('button', { name: '초대' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '닉네임으로 회원 찾기' }), { target: { value: '첼로' } });
    await act(async () => { vi.advanceTimersByTime(400); });
    const results = await screen.findByRole('list', { name: '검색 결과' });
    fireEvent.click(within(results).getByRole('button', { name: /김첼로/ }));

    await waitFor(() => expect(postBff).toHaveBeenCalledWith(
      '/api/bff/chat/rooms/3/participants', { memberIds: [9] }));
  });

  it('나가면 목록으로 돌아간다', async () => {
    // 나가기는 되돌릴 수 없어 확인을 묻는다. jsdom 에는 confirm 이 없어 스텁한다.
    vi.stubGlobal('confirm', () => true);
    mockRoom(groupRoom);
    deleteBff.mockResolvedValue({ ok: true });
    render(<ChatRoomPage />);
    fireEvent.click(await screen.findByRole('button', { name: '나가기' }));
    await waitFor(() => expect(deleteBff).toHaveBeenCalledWith('/api/bff/chat/rooms/3/participants/me'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/chat'));
  });
});

describe('1:1 대화창', () => {
  it('초대·나가기를 두지 않는다', async () => {
    // DIRECT 에 참여자를 더하면 1:1의 의미가 깨진다(STATUTE §139 — BE도 400으로 막는다).
    mockRoom(directRoom);
    render(<ChatRoomPage />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: '초대' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '나가기' })).not.toBeInTheDocument();
  });

  it('확인을 취소하면 나가지 않는다', () => {
    vi.stubGlobal('confirm', () => false);
    mockRoom(groupRoom);
    render(<ChatRoomPage />);
    return screen.findByRole('button', { name: '나가기' }).then((btn) => {
      fireEvent.click(btn);
      expect(deleteBff).not.toHaveBeenCalled();
    });
  });
});
