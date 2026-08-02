import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '1' }) }));

const getBff = vi.fn();
const postBff = vi.fn();
const putBff = vi.fn();
const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  postBff: (...a: unknown[]) => postBff(...a),
  putBff: (...a: unknown[]) => putBff(...a),
  deleteBff: (...a: unknown[]) => deleteBff(...a),
}));

import FeedDetailPage from '@/app/feed/[id]/page';

const postData = {
  id: 1, author: { id: 5, nickname: '글쓴이', verified: false }, content: '상세본문',
  likeCount: 0, commentCount: 1, likedByMe: false, createdAt: 'x', updatedAt: 'x',
};
// 댓글 작성자는 게시글 작성자(=me, id 5)와 의도적으로 다른 id를 쓴다.
// 동일 id로 두면 게시글/댓글의 "삭제" 버튼이 둘 다 렌더링되어
// getByRole('button', { name: '삭제' })가 다중 매치로 실패한다(브리프 픽스처 충돌, 페이지 로직 문제 아님).
const comment = {
  id: 9, postId: 1, author: { id: 6, nickname: '댓쓴이', verified: false },
  content: '첫 댓글', likeCount: 0, likedByMe: false, createdAt: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
    if (path === '/api/bff/feed/posts/1') return { ok: true, data: postData, message: null };
    if (path.startsWith('/api/bff/feed/posts/1/comments')) return { ok: true, data: { items: [comment], nextCursor: null }, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('FeedDetailPage', () => {
  it('게시글과 댓글을 보여준다', async () => {
    render(<FeedDetailPage />);
    expect(await screen.findByText('상세본문')).toBeInTheDocument();
    expect(await screen.findByText('첫 댓글')).toBeInTheDocument();
  });

  it('작성자 본인이면 수정/삭제 버튼을 보여준다', async () => {
    render(<FeedDetailPage />);
    expect(await screen.findByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('댓글을 작성하면 목록에 추가된다', async () => {
    postBff.mockResolvedValue({ ok: true, data: { ...comment, id: 10, content: '새 댓글' }, message: null });
    render(<FeedDetailPage />);
    await screen.findByText('첫 댓글');
    fireEvent.change(screen.getByPlaceholderText(/댓글/), { target: { value: '새 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 작성' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/feed/posts/1/comments', { content: '새 댓글' }));
    expect(await screen.findByText('새 댓글')).toBeInTheDocument();
  });

  it('없는 게시글(404)이면 안내를 보여준다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
      if (path === '/api/bff/feed/posts/1') return { ok: false, message: '없음' };
      return { ok: true, data: { items: [], nextCursor: null }, message: null };
    });
    render(<FeedDetailPage />);
    expect(await screen.findByText(/삭제되었거나 없는 게시글/)).toBeInTheDocument();
  });
});
