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

  it('연속 토글 중 먼저 보낸 요청이 늦게 실패해도, 최신 성공 토글만큼의 상태가 유지된다', async () => {
    // 재현 시나리오: likedByMe=false(count=1) 상태에서
    //   1) 좋아요 추가 클릭 -> POST 요청 A 전송(아직 미해결), 낙관적으로 likedByMe=true/count=2
    //   2) 좋아요 취소 클릭 -> DELETE 요청 B 전송, 낙관적으로 likedByMe=false/count=1, B는 즉시 성공
    //   3) 요청 A가 늦게 실패로 응답
    //
    // toggleLike는 자기 자신의 역원이므로(두 번 적용하면 원상복구) 롤백은 "그 시점의 최신 상태"에
    // 토글을 한 번 더 적용하는 방식으로 이루어진다. 클릭마다 1회, 실패한 요청마다 롤백으로 1회씩
    // 토글이 누적되므로, 최종 상태는 "성공한 토글 횟수의 홀짝"으로 결정된다(스냅샷 복원과 달리
    // 중간에 끼어든 성공한 토글을 지우지 않는다).
    // 이 시나리오는 성공한 토글이 1회(B)이므로, 좋아요를 한 번만 눌러 성공한 것과 동일한 결과
    // (likedByMe=true, count=2)로 수렴해야 한다 — A의 실패가 B의 결과를 스냅샷으로 덮어쓰지 않는다.
    let resolveA: (v: { ok: boolean; message: string | null }) => void;
    const pendingA = new Promise<{ ok: boolean; message: string | null }>((res) => { resolveA = res; });
    postBff.mockReturnValueOnce(pendingA);
    deleteBff.mockResolvedValueOnce({ ok: true, data: null, message: null });

    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
      if (path.startsWith('/api/bff/feed/posts')) return { ok: true, data: { items: [post(3, { likeCount: 1, likedByMe: false })], nextCursor: null }, message: null };
      return { ok: false, message: 'x' };
    });

    render(<FeedPage />);
    await screen.findByText('글3');

    const likeBtn = screen.getByRole('button', { name: /1/ });
    fireEvent.click(likeBtn); // -> POST A 전송, count=2로 낙관적 반영
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /2/ })); // -> DELETE B 전송, count=1로 낙관적 반영(즉시 성공)
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    await waitFor(() => expect(deleteBff).toHaveBeenCalled());

    // A가 이제서야 실패로 응답한다. B가 만든 최신 상태(count=1) 위에 롤백 토글이 한 번 더 적용되어
    // count=2(likedByMe=true)로 수렴해야 하며, count=1로 되돌아가서는 안 된다.
    resolveA!({ ok: false, message: 'x' });
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });
});
