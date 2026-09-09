import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostCard } from '@/components/feed/PostCard';
import { PostingCard } from '@/components/recruitment/PostingCard';
import { PerformanceCard } from '@/components/performance/PerformanceCard';
import { LikeButton } from '@/components/feed/LikeButton';
import { ComposeForm } from '@/components/feed/ComposeForm';
import type { Post } from '@/lib/feed/types';
import type { Posting } from '@/lib/recruitment/types';
import type { Performance } from '@/lib/performance/types';

/**
 * 카드 3종(피드·구인·공연)은 `<article onClick>`이라 마우스로만 열 수 있었다.
 * 키보드 사용자와 스크린리더 사용자는 상세로 갈 방법이 없다.
 * 세 카드가 같은 결함을 공유하므로 한 파일에서 같은 기준으로 단언한다.
 */

const post: Post = {
  id: 1, author: { id: 5, nickname: '글쓴이', verified: false },
  content: '리허설 일정 공유합니다', likeCount: 3, commentCount: 2, likedByMe: false,
  createdAt: '2026-08-02T00:00:00', updatedAt: '2026-08-02T00:00:00',
};
const posting: Posting = {
  id: 2, title: '첼로 구합니다', author: { id: 5, nickname: '글쓴이', verified: false },
  description: '함께 하실 분 찾습니다', instruments: ['CELLO'], location: '서울',
  deadline: '2026-12-01T00:00:00', closed: false, status: 'OPEN', recruitCount: 1, fee: null,
  createdAt: '2026-08-02T00:00:00', updatedAt: '2026-08-02T00:00:00',
};
const performance: Performance = {
  id: 3, title: '가을 정기연주회', organizer: { id: 5, nickname: '글쓴이', verified: true },
  performedAt: '2026-11-01T19:30:00', venue: '예술의전당', description: '',
  program: '', ticketInfo: null, ticketUrl: null, posterImageUrl: null, createdAt: '2026-08-02T00:00:00', updatedAt: '2026-08-02T00:00:00',
};

describe('카드 키보드 접근', () => {
  it('피드 카드는 본문을 이름으로 갖는 버튼으로 열 수 있다', () => {
    const onOpen = vi.fn();
    render(<PostCard post={post} onLike={vi.fn()} onOpen={onOpen} />);
    const open = screen.getByRole('button', { name: /리허설 일정 공유합니다/ });
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('구인 카드는 공고 제목이 버튼 이름이다', () => {
    const onOpen = vi.fn();
    render(<PostingCard posting={posting} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '첼로 구합니다' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('공연 카드는 공연 제목이 버튼 이름이다', () => {
    const onOpen = vi.fn();
    render(<PerformanceCard performance={performance} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '가을 정기연주회' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('제목은 여전히 heading이다 — 버튼으로 감싸도 제목 훑기가 살아 있어야 한다', () => {
    render(<PostingCard posting={posting} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '첼로 구합니다' })).toBeInTheDocument();
  });
});

describe('컨트롤 접근명', () => {
  it('좋아요 버튼은 숫자만이 아니라 무엇인지 읽힌다', () => {
    render(<LikeButton liked={false} count={3} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: '좋아요 3개' })).toBeInTheDocument();
  });

  it('좋아요 상태는 aria-pressed로 전달된다', () => {
    render(<LikeButton liked count={1} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: '좋아요 1개' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('작성 textarea는 placeholder 말고 접근명을 갖는다', () => {
    render(<ComposeForm placeholder="무슨 생각을 하고 있나요?" maxLength={2000}
      buttonLabel="게시" onSubmit={async () => true} />);
    expect(screen.getByRole('textbox', { name: '무슨 생각을 하고 있나요?' })).toBeInTheDocument();
  });
});
