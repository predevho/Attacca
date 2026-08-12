import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

import ChatListPage from '@/app/chat/page';

const page = { content: [{ id: 1, type: 'DIRECT', displayName: '홍길동',
  lastMessage: { content: '안녕', senderId: 2, createdAt: '' }, unreadCount: 2, lastMessageAt: '' }],
  number: 0, totalPages: 1, last: true };

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); postBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'Me', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/chat/rooms')) return Promise.resolve({ ok: true, data: page });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('ChatListPage', () => {
  it('방 목록 렌더', async () => {
    render(<ChatListPage />);
    expect(await screen.findByText('홍길동')).toBeInTheDocument();
  });
  it('방 클릭 시 대화창으로 push', async () => {
    render(<ChatListPage />);
    fireEvent.click(await screen.findByText('홍길동'));
    expect(push).toHaveBeenCalledWith('/chat/1');
  });
  it('새 대화 성공 시 생성된 방으로 push', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 5, type: 'DIRECT', title: null, participants: [], createdAt: '' } });
    render(<ChatListPage />);
    await screen.findByText('홍길동');
    fireEvent.change(screen.getByLabelText('회원 id'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '대화 시작' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/chat/rooms', { type: 'DIRECT', participantIds: [7] }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/chat/5'));
  });
});
