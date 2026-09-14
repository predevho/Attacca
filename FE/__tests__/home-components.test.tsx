import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { MonthCalendar } from '@/components/home/MonthCalendar';

const slides = [
  { kind: 'PERFORMANCE' as const, id: 1, title: '첫 공연', caption: '오늘', body: null, imageUrl: '/one.jpg', href: '/performances/1' },
  { kind: 'NOTICE' as const, id: 2, title: '두 번째 소식', caption: '내일', body: null, imageUrl: '/two.jpg', href: '/notices/2' },
];

const entries = [
  { kind: 'PERFORMANCE' as const, id: 1, title: '첫 공연', at: '2026-09-12T19:30:00', place: '홀 A', href: '/performances/1' },
  { kind: 'NOTICE' as const, id: 2, title: '공지 일정', at: '2026-09-12T10:00:00', place: null, href: null },
  { kind: 'PERFORMANCE' as const, id: 3, title: '다른 공연', at: '2026-09-20T19:30:00', place: null, href: '/performances/3' },
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
