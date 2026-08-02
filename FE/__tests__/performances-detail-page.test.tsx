import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const push = vi.fn();
let searchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: '1' }),
  useSearchParams: () => searchParams,
}));

const getBff = vi.fn();
const deleteBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  deleteBff: (...a: unknown[]) => deleteBff(...a),
}));

import PerformanceDetailPage from '@/app/performances/[id]/page';

const perf = {
  id: 1, organizer: { id: 5, nickname: '주최자', verified: true }, title: '가을 리사이틀',
  description: '설명', performedAt: '2026-09-01T19:30:00', venue: '예술의전당', program: '프로그램',
  ticketInfo: '전석 3만원', ticketUrl: 'http://t', posterImageUrl: null, createdAt: 'x', updatedAt: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams('');
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
    if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('PerformanceDetailPage', () => {
  it('공연 정보를 보여준다', async () => {
    render(<PerformanceDetailPage />);
    expect(await screen.findByText('가을 리사이틀')).toBeInTheDocument();
    expect(screen.getByText('예술의전당')).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.01 19:30/)).toBeInTheDocument();
  });

  it('주최자 본인이면 수정/삭제 버튼을 보여준다', async () => {
    render(<PerformanceDetailPage />);
    expect(await screen.findByRole('button', { name: '수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('주최자가 아니면 수정/삭제가 없다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 9, nickname: '남', role: 'USER', verified: false }, message: null };
      if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
      return { ok: false, message: 'x' };
    });
    render(<PerformanceDetailPage />);
    await screen.findByText('가을 리사이틀');
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  });

  it('없는 공연이면 안내를 보여준다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
      if (path === '/api/bff/performances/1') return { ok: false, message: '없음' };
      return { ok: false, message: 'x' };
    });
    render(<PerformanceDetailPage />);
    expect(await screen.findByText(/삭제되었거나 없는 공연/)).toBeInTheDocument();
  });

  it('posterFailed 쿼리면 배너를 보여준다', async () => {
    searchParams = new URLSearchParams('posterFailed=1');
    render(<PerformanceDetailPage />);
    expect(await screen.findByText(/포스터 업로드에 실패/)).toBeInTheDocument();
  });
});
