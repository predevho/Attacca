import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const getBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
}));

import HomePage from '@/app/page';

function page<T>(content: T[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    first: true,
    last: true,
  };
}

const PERFORMANCE = {
  id: 1,
  organizer: { nickname: '정하윤', verified: true },
  title: '한강 체임버 오케스트라 정기연주회',
  description: '브람스 교향곡 2번',
  performedAt: '2026-09-26T19:30:00',
  venue: '한강아트홀',
  program: null,
  ticketInfo: null,
  ticketUrl: null,
  posterImageUrl: null,
  createdAt: '2026-09-01T00:00:00',
};

const NOTICE = {
  id: 2,
  type: 'NOTICE' as const,
  title: '인증 연주자 심사 절차 변경',
  content: '본문',
  scheduledAt: null,
  place: null,
  coverImageUrl: null,
  createdAt: '2026-09-01T00:00:00',
};

const LATEST_POST = {
  id: 10,
  author: { nickname: '서지호', verified: false },
  content: '첫 독주회 프로그램 조언 부탁드려요',
  likeCount: 17,
  commentCount: 12,
  createdAt: '2026-09-07T00:00:00',
};

const POPULAR_POST = {
  id: 11,
  author: { nickname: '박세진', verified: false },
  content: '무대 공포증 이렇게 넘겼습니다',
  likeCount: 41,
  commentCount: 23,
  createdAt: '2026-09-06T00:00:00',
};

const CALENDAR = [
  {
    kind: 'PERFORMANCE' as const,
    id: 1,
    title: '한강 체임버 오케스트라 정기연주회',
    at: '2026-09-26T19:30:00',
    place: '한강아트홀',
    href: '/performances/1',
  },
  {
    kind: 'NOTICE' as const,
    id: 5,
    title: '심사 결과 발표',
    at: '2026-09-16T10:00:00',
    place: null,
    href: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/public/performances')) return { ok: true, data: page([PERFORMANCE]), message: null };
    if (path.startsWith('/api/bff/public/notices')) return { ok: true, data: page([NOTICE]), message: null };
    if (path.includes('sort=POPULAR')) return { ok: true, data: page([POPULAR_POST]), message: null };
    if (path.startsWith('/api/bff/public/feed/posts')) return { ok: true, data: page([LATEST_POST]), message: null };
    if (path.startsWith('/api/bff/public/calendar')) return { ok: true, data: CALENDAR, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('홈', () => {
  it('공개 조회만 쓴다 — 신원 조회를 하지 않는다', async () => {
    render(<HomePage />);
    await screen.findByRole('heading', { name: '한강 체임버 오케스트라 정기연주회' });
    const called = getBff.mock.calls.map((c) => String(c[0]));
    expect(called.every((p) => p.startsWith('/api/bff/public/'))).toBe(true);
  });

  it('히어로에 다가오는 공연을 배지·일시와 함께 보여준다', async () => {
    render(<HomePage />);
    expect(await screen.findByRole('heading', { name: '한강 체임버 오케스트라 정기연주회' })).toBeInTheDocument();
    // '공연'은 달력 범례에도 있으므로 히어로 안으로 한정한다.
    const hero = within(screen.getByRole('region', { name: '주요 소식' }));
    expect(hero.getByText('공연')).toBeInTheDocument();
    expect(hero.getByText('2026.09.26 (토) 19:30 · 한강아트홀')).toBeInTheDocument();
  });

  it('히어로 슬라이드를 좌우로 넘길 수 있다', async () => {
    render(<HomePage />);
    await screen.findByRole('heading', { name: '한강 체임버 오케스트라 정기연주회' });
    fireEvent.click(screen.getByRole('button', { name: '다음 소식' }));
    expect(await screen.findByRole('heading', { name: '인증 연주자 심사 절차 변경' })).toBeInTheDocument();
  });

  it('최신글을 보여주고 상세는 인증 경로로 링크한다', async () => {
    render(<HomePage />);
    const link = await screen.findByRole('link', { name: /첫 독주회 프로그램 조언 부탁드려요/ });
    expect(link).toHaveAttribute('href', '/feed/10');
  });

  it('인기글 탭을 누르면 POPULAR로 다시 조회한다', async () => {
    render(<HomePage />);
    await screen.findByText(/첫 독주회 프로그램 조언 부탁드려요/);

    fireEvent.click(screen.getByRole('button', { name: '인기글' }));

    expect(await screen.findByText(/무대 공포증 이렇게 넘겼습니다/)).toBeInTheDocument();
    expect(getBff.mock.calls.some((c) => String(c[0]).includes('sort=POPULAR'))).toBe(true);
  });

  it('달력에 이번 달 일정을 공연·공지 함께 보여준다', async () => {
    render(<HomePage />);
    expect(await screen.findByText('심사 결과 발표')).toBeInTheDocument();
    expect(screen.getByText('09.16 (수)')).toBeInTheDocument();
    expect(screen.getByText('09.26 (토) · 한강아트홀')).toBeInTheDocument();
  });

  it('달을 넘기면 그 달 범위로 다시 조회한다', async () => {
    render(<HomePage />);
    await screen.findByText('심사 결과 발표');
    const before = getBff.mock.calls.filter((c) => String(c[0]).startsWith('/api/bff/public/calendar')).length;

    fireEvent.click(screen.getByRole('button', { name: '다음 달' }));

    await waitFor(() => {
      const after = getBff.mock.calls.filter((c) => String(c[0]).startsWith('/api/bff/public/calendar')).length;
      expect(after).toBe(before + 1);
    });
  });

  it('조회가 실패해도 화면이 로딩에 멈추지 않는다', async () => {
    getBff.mockResolvedValue({ ok: false, message: '서버에 연결할 수 없습니다.' });
    render(<HomePage />);
    expect(await screen.findByText('아직 게시글이 없습니다.')).toBeInTheDocument();
    expect(screen.getByText('이번 달 일정이 없습니다.')).toBeInTheDocument();
  });
});
