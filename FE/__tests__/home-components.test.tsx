import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { MonthCalendar } from '@/components/home/MonthCalendar';
import { PostWidget } from '@/components/home/PostWidget';

const slides = [
  { kind: 'PERFORMANCE' as const, id: 1, title: '첫 공연', caption: '오늘', body: null, imageUrl: '/one.jpg', href: '/performances/1' },
  { kind: 'NOTICE' as const, id: 2, title: '두 번째 소식', caption: '내일', body: null, imageUrl: '/two.jpg', href: '/notices/2' },
];

const entries = [
  { kind: 'PERFORMANCE' as const, id: 1, title: '첫 공연', at: '2026-09-12T19:30:00', place: '홀 A', href: '/performances/1' },
  { kind: 'NOTICE' as const, id: 2, title: '공지 일정', at: '2026-09-12T10:00:00', place: null, href: null },
  { kind: 'PERFORMANCE' as const, id: 3, title: '다른 공연', at: '2026-09-20T19:30:00', place: null, href: '/performances/3' },
];

const posts = [
  {
    id: 10,
    author: { nickname: '서지호', verified: true },
    content: '모바일에서도 본문이 끝까지 읽히는 게시글입니다.',
    likeCount: 17,
    commentCount: 12,
    createdAt: '2026-09-07T00:00:00',
  },
];

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => vi.useRealTimers());

describe('HeroCarousel', () => {
  it('자동재생을 일시정지하고 재개할 수 있으며 현재 상태를 알린다', () => {
    vi.useFakeTimers();
    render(<HeroCarousel slides={slides} />);

    const region = screen.getByRole('region', { name: '주요 소식' });
    expect(within(region).getByRole('button', { name: '자동재생 일시정지' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(region).getByRole('button', { name: '자동재생 일시정지' }));
    expect(within(region).getByRole('button', { name: '자동재생 재개' })).toHaveAttribute('aria-pressed', 'true');
    act(() => vi.advanceTimersByTime(6000));
    expect(within(region).getByRole('heading', { name: '첫 공연' })).toBeInTheDocument();
    fireEvent.click(within(region).getByRole('button', { name: '자동재생 재개' }));
    act(() => vi.advanceTimersByTime(6000));
    expect(within(region).getByRole('heading', { name: '두 번째 소식' })).toBeInTheDocument();
  });

  it('reduced-motion 환경에서는 자동재생을 시작하지 않는다', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.useFakeTimers();
    render(<HeroCarousel slides={slides} />);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.getByRole('heading', { name: '첫 공연' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '자동재생 재개' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('이미지 로드 실패 시 슬라이드 내용을 유지한 대체 상태를 보여준다', () => {
    render(<HeroCarousel slides={slides} />);
    fireEvent.error(screen.getByAltText('첫 공연 이미지'));
    expect(screen.getByText('이미지를 불러오지 못했습니다.')).toBeInTheDocument();
  });
});

describe('MonthCalendar', () => {
  it('일정이 있는 날짜의 종류와 건수를 접근성 이름으로 전달한다', () => {
    render(<MonthCalendar year={2026} month={9} entries={entries} today={12} isLoading={false} onShiftMonth={vi.fn()} />);
    expect(screen.getByRole('button', { name: '9월 12일, 공연 1건, 공지 일정 1건' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9월 20일, 공연 1건' })).toBeInTheDocument();
  });

  it('날짜를 선택하면 해당 날짜의 일정 목록과 연결한다', () => {
    render(<MonthCalendar year={2026} month={9} entries={entries} today={12} isLoading={false} onShiftMonth={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '9월 20일, 공연 1건' }));
    const list = screen.getByRole('region', { name: '선택한 날짜 일정' });
    expect(within(list).getByText('다른 공연')).toBeInTheDocument();
    expect(within(list).queryByText('첫 공연')).not.toBeInTheDocument();
  });
});

describe('PostWidget', () => {
  it('최신글과 인기글을 접근 가능한 탭과 연결된 패널로 제공한다', () => {
    render(<PostWidget posts={posts} sort="LATEST" isLoading={false} onSortChange={vi.fn()} />);

    const tablist = screen.getByRole('tablist', { name: '게시글 정렬' });
    const latest = within(tablist).getByRole('tab', { name: '최신글' });
    const popular = within(tablist).getByRole('tab', { name: '인기글' });

    expect(latest).toHaveAttribute('aria-selected', 'true');
    expect(popular).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: '최신글' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: '최신글' })).toHaveAttribute('aria-labelledby', latest.id);
  });

  it('탭에서 방향키로 다음 탭에 포커스를 이동하고 선택을 요청한다', () => {
    const onSortChange = vi.fn();
    render(<PostWidget posts={posts} sort="LATEST" isLoading={false} onSortChange={onSortChange} />);

    const latest = screen.getByRole('tab', { name: '최신글' });
    const popular = screen.getByRole('tab', { name: '인기글' });
    latest.focus();
    fireEvent.keyDown(latest, { key: 'ArrowRight' });

    expect(popular).toHaveFocus();
    expect(onSortChange).toHaveBeenCalledWith('POPULAR');
  });

  it('게시글 본문과 메타 정보를 모바일에서도 줄바꿈 가능한 레이아웃으로 렌더링한다', () => {
    render(<PostWidget posts={posts} sort="LATEST" isLoading={false} onSortChange={vi.fn()} />);

    const link = screen.getByRole('link', { name: /모바일에서도 본문이 끝까지/ });
    expect(link).toHaveClass('items-start');
    expect(screen.getByText(posts[0].content)).toHaveClass('break-words');
    expect(screen.getByText('서지호')).toHaveClass('min-w-0');
  });
});
