import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostCard } from '@/components/feed/PostCard';
import { CommentItem } from '@/components/feed/CommentItem';
import type { Post, Comment, Me } from '@/lib/feed/types';

const post: Post = {
  id: 1, author: { id: 5, nickname: '글쓴이', verified: false },
  content: '본문내용', likeCount: 3, commentCount: 2, likedByMe: false,
  createdAt: '2026-08-02T00:00:00', updatedAt: '2026-08-02T00:00:00',
};

describe('PostCard', () => {
  it('본문/댓글수를 보여주고 카드 클릭 시 onOpen 호출', () => {
    const onOpen = vi.fn();
    render(<PostCard post={post} onLike={vi.fn()} onOpen={onOpen} />);
    expect(screen.getByText('본문내용')).toBeInTheDocument();
    fireEvent.click(screen.getByText('본문내용'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
  it('좋아요 버튼 클릭은 onOpen을 트리거하지 않는다', () => {
    const onOpen = vi.fn();
    const onLike = vi.fn();
    render(<PostCard post={post} onLike={onLike} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLike).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('CommentItem', () => {
  const comment: Comment = {
    id: 9, postId: 1, author: { id: 5, nickname: '댓쓴이', verified: false },
    content: '댓글이다', likeCount: 0, likedByMe: false, createdAt: '2026-08-02T00:00:00',
  };
  it('작성자 본인이면 삭제 버튼을 보여준다', () => {
    const me: Me = { id: 5, nickname: '댓쓴이', role: 'USER', verified: false };
    render(<CommentItem comment={comment} me={me} onLike={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });
  it('타인이면 삭제 버튼이 없다', () => {
    const me: Me = { id: 6, nickname: '남', role: 'USER', verified: false };
    render(<CommentItem comment={comment} me={me} onLike={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });
});
