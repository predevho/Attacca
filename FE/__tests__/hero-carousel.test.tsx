import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import type { Slide } from '@/lib/home/types';

const slides: Slide[] = [
  { kind: 'PERFORMANCE', id: 1, title: '가을 정기연주회', caption: '11월 1일 · 예술의전당',
    body: '브람스 클라리넷 오중주', imageUrl: 'http://x/1.png', href: '/performances/1' },
  { kind: 'NOTICE', id: 2, title: '운영 안내', caption: '9월 9일',
    body: null, imageUrl: null, href: '/notices/2' },
  { kind: 'NEWS', id: 3, title: '새 소식', caption: '9월 8일',
    body: null, imageUrl: 'http://x/3.png', href: null },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** 화면에 보이는(활성) 슬라이드의 제목. 비활성은 aria-hidden이라 접근성 트리에서 빠진다. */
function shownTitle() {
  return screen.getByRole('heading', { level: 2 }).textContent;
}

describe('HeroCarousel', () => {
  it('시간이 지나면 자동으로 다음 장으로 넘어간다', () => {
    render(<HeroCarousel slides={slides} />);
    expect(shownTitle()).toBe('가을 정기연주회');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(shownTitle()).toBe('운영 안내');
  });

  it('내가 직접 넘기면 자동 전환이 멈춘다', () => {
    // 읽는 중에 화면이 스스로 바뀌면 방해가 된다. 손을 댄 순간 주도권을 넘긴다.
    render(<HeroCarousel slides={slides} />);
    fireEvent.click(screen.getByRole('button', { name: '다음 소식' }));
    expect(shownTitle()).toBe('운영 안내');

    // 6000의 배수로 재면 장수(3)와 맞물려 제자리로 돌아와 버려 구분이 안 된다. 한 틱만 재운다.
    act(() => { vi.advanceTimersByTime(6000); });
    expect(shownTitle()).toBe('운영 안내'); // 그대로 멈춰 있다
  });

  it('점을 눌러 이동해도 자동 전환이 멈춘다', () => {
    render(<HeroCarousel slides={slides} />);
    fireEvent.click(screen.getByRole('button', { name: '3번째 소식 보기' }));
    expect(shownTitle()).toBe('새 소식');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(shownTitle()).toBe('새 소식');
  });

  it('보이지 않는 슬라이드의 링크는 탭 순서에서 빠진다', () => {
    // 모든 장을 한 줄에 깔아 두고 밀어서 보여주므로, 안 보이는 장의 링크로
    // 탭이 들어가면 화면 밖으로 포커스가 사라진다.
    render(<HeroCarousel slides={slides} />);
    // 세 장이 모두 DOM에 있어야 밀어서 보여줄 수 있다.
    expect(screen.getAllByRole('heading', { level: 2, hidden: true })).toHaveLength(3);
    // 그중 보이는 것은 한 장뿐이다.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);

    const links = screen.getAllByRole('link', { hidden: true });
    const active = links.filter((a) => a.getAttribute('tabindex') !== '-1');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('href', '/performances/1');
  });

  it('한 장뿐이면 넘기는 컨트롤을 두지 않는다', () => {
    render(<HeroCarousel slides={[slides[0]]} />);
    expect(screen.queryByRole('button', { name: '다음 소식' })).not.toBeInTheDocument();
  });

  it('이미지가 없는 장도 같은 자리에 렌더된다', () => {
    render(<HeroCarousel slides={slides} />);
    fireEvent.click(screen.getByRole('button', { name: '2번째 소식 보기' }));
    expect(shownTitle()).toBe('운영 안내');
  });
});
