import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (...a: unknown[]) => getBff(...a) }));

import PerformancesPage from '@/app/performances/page';

function page(items: unknown[], last = true, number = 0) {
  return { ok: true, data: { content: items, number, totalPages: 1, last }, message: null };
}
function perf(id: number, title: string) {
  return { id, organizer: { id: 5, nickname: '주최', verified: true }, title, description: null,
    performedAt: '2026-09-01T19:30:00', venue: '홀', program: null, ticketInfo: null, ticketUrl: null,
    posterImageUrl: null, createdAt: 'x', updatedAt: 'x' };
}

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
    if (path.startsWith('/api/bff/performances')) return page([perf(1, '공연A'), perf(2, '공연B')]);
    return { ok: false, message: 'x' };
  });
});

describe('PerformancesPage', () => {
  it('공연 목록을 보여준다', async () => {
    render(<PerformancesPage />);
    expect(await screen.findByText('공연A')).toBeInTheDocument();
    expect(screen.getByText('공연B')).toBeInTheDocument();
  });

  it('인증 연주자면 공연 등록 버튼을 보여준다', async () => {
    render(<PerformancesPage />);
    expect(await screen.findByRole('button', { name: '공연 등록' })).toBeInTheDocument();
  });

  it('비자격이면 공연 등록 버튼이 없다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null };
      if (path.startsWith('/api/bff/performances')) return page([perf(1, '공연A')]);
      return { ok: false, message: 'x' };
    });
    render(<PerformancesPage />);
    await screen.findByText('공연A');
    expect(screen.queryByRole('button', { name: '공연 등록' })).not.toBeInTheDocument();
  });

  it('카드를 클릭하면 상세로 이동', async () => {
    render(<PerformancesPage />);
    fireEvent.click(await screen.findByText('공연A'));
    expect(push).toHaveBeenCalledWith('/performances/1');
  });

  it('scope 탭을 바꾸면 해당 scope로 다시 조회', async () => {
    render(<PerformancesPage />);
    await screen.findByText('공연A');
    fireEvent.click(screen.getByRole('button', { name: '지난' }));
    await waitFor(() => {
      const called = getBff.mock.calls.map((c) => String(c[0]));
      expect(called.some((u) => u.includes('scope=PAST'))).toBe(true);
    });
  });
});
