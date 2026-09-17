import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

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
    if (p.startsWith('/api/bff/members/search')) {
      return Promise.resolve({ ok: true, data: [{ id: 7, nickname: '정하윤', verified: false }] });
    }
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('ChatListPage', () => {
  it('방 목록 렌더', async () => {
    render(<ChatListPage />);
    expect(await screen.findByText('홍길동')).toBeInTheDocument();
  });
  it('모바일에서도 제목과 새 채팅 액션을 접근 가능한 헤더로 제공', async () => {
    render(<ChatListPage />);

    const main = await screen.findByRole('main', { name: '채팅' });
    expect(main).toHaveClass('px-4', 'sm:px-6');

    const heading = within(main).getByRole('heading', { name: '채팅', level: 1 });
    expect(heading.parentElement).toHaveClass('flex', 'items-start', 'justify-between');
    expect(within(main).getByRole('group', { name: '새 대화 시작' })).toBeInTheDocument();
    expect(within(main).getByRole('group', { name: '그룹 만들기' })).toBeInTheDocument();
  });
  it('방 클릭 시 대화창으로 push', async () => {
    render(<ChatListPage />);
    fireEvent.click(await screen.findByText('홍길동'));
    expect(push).toHaveBeenCalledWith('/chat/1');
  });
  it('닉네임으로 찾아 고르면 그 회원과의 방으로 push', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 5, type: 'DIRECT', title: null, participants: [], createdAt: '' } });
    render(<ChatListPage />);
    await screen.findByText('홍길동');

    // 화면에 검색창이 둘이다(1:1 시작 / 그룹 만들기) — 1:1 쪽으로 좁힌다.
    const direct = screen.getByRole('group', { name: '새 대화 시작' });
    fireEvent.change(within(direct).getByRole('searchbox', { name: '닉네임으로 회원 찾기' }), { target: { value: '하윤' } });
    fireEvent.click(await within(direct).findByRole('button', { name: /정하윤/ }));

    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/chat/rooms', { type: 'DIRECT', participantIds: [7] }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/chat/5'));
  });
});
