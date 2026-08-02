import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const getBff = vi.fn();
const postBff = vi.fn();
const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  postBff: (...a: unknown[]) => postBff(...a),
  deleteBff: (...a: unknown[]) => deleteBff(...a),
}));

import FeedPage from '@/app/feed/page';

function post(id: number, over: Partial<Record<string, unknown>> = {}) {
  return { id, author: { id: 5, nickname: '글쓴이', verified: false }, content: `글${id}`,
    likeCount: 1, commentCount: 0, likedByMe: false, createdAt: 'x', updatedAt: 'x', ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
    if (path.startsWith('/api/bff/feed/posts')) return { ok: true, data: { items: [post(3), post(2)], nextCursor: null }, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('FeedPage', () => {
  it('타임라인 게시글을 보여준다', async () => {
    render(<FeedPage />);
    expect(await screen.findByText('글3')).toBeInTheDocument();
    expect(screen.getByText('글2')).toBeInTheDocument();
  });

  it('작성하면 목록 맨 앞에 추가된다', async () => {
    postBff.mockResolvedValue({ ok: true, data: post(9, { content: '새글' }), message: null });
    render(<FeedPage />);
    await screen.findByText('글3');
    fireEvent.change(screen.getByPlaceholderText(/무슨 생각/), { target: { value: '새글' } });
    fireEvent.click(screen.getByRole('button', { name: '게시' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/feed/posts', { content: '새글' }));
    expect(await screen.findByText('새글')).toBeInTheDocument();
  });

  it('좋아요 실패 시 롤백한다', async () => {
    deleteBff.mockResolvedValue({ ok: false, message: 'x' });
    postBff.mockResolvedValue({ ok: false, message: 'x' });
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
      if (path.startsWith('/api/bff/feed/posts')) return { ok: true, data: { items: [post(3, { likeCount: 1, likedByMe: false })], nextCursor: null }, message: null };
      return { ok: false, message: 'x' };
    });
    // 좋아요 추가 실패(POST) 시 원래 카운트 1로 복구
    postBff.mockResolvedValueOnce({ ok: false, message: 'x' });
    render(<FeedPage />);
    await screen.findByText('글3');
    const likeBtn = screen.getByRole('button', { name: /1/ });
    fireEvent.click(likeBtn);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });
});
