import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostingCard } from '@/components/recruitment/PostingCard';
import type { Posting } from '@/lib/recruitment/types';

const posting: Posting = {
  id: 1, author: { id: 9, nickname: '홍길동', verified: true }, title: '피아노 반주자',
  description: null, instruments: ['PIANO'], recruitCount: 2, location: '서울', fee: '협의',
  deadline: null, status: 'OPEN', closed: false, createdAt: '2026-08-01T00:00', updatedAt: '2026-08-01T00:00',
};

describe('PostingCard', () => {
  it('제목/지역/상시모집 표시', () => {
    render(<PostingCard posting={posting} onOpen={() => {}} />);
    expect(screen.getByText('피아노 반주자')).toBeInTheDocument();
    expect(screen.getByText(/상시모집/)).toBeInTheDocument();
  });

  it('마감된 공고는 마감 뱃지', () => {
    render(<PostingCard posting={{ ...posting, closed: true }} onOpen={() => {}} />);
    expect(screen.getByText('마감')).toBeInTheDocument();
  });

  it('클릭 시 onOpen', () => {
    const onOpen = vi.fn();
    render(<PostingCard posting={posting} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('피아노 반주자'));
    expect(onOpen).toHaveBeenCalled();
  });
});
