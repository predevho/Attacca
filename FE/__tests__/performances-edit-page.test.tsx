import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '1' }) }));

const getBff = vi.fn();
const putBff = vi.fn();
const putBffForm = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  putBff: (...a: unknown[]) => putBff(...a),
  putBffForm: (...a: unknown[]) => putBffForm(...a),
}));

import EditPerformancePage from '@/app/performances/[id]/edit/page';

const perf = {
  id: 1, organizer: { id: 5, nickname: '주최자', verified: true }, title: '가을 리사이틀',
  description: '설명', performedAt: '2026-09-01T19:30:00', venue: '예술의전당', program: '',
  ticketInfo: '', ticketUrl: '', posterImageUrl: null, createdAt: 'x', updatedAt: 'x',
};

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null };
    if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
    return { ok: false, message: 'x' };
  });
});

describe('EditPerformancePage', () => {
  it('기존 값을 채우고 저장하면 PUT 후 상세로', async () => {
    putBff.mockResolvedValue({ ok: true, data: { ...perf, title: '수정됨' }, message: null });
    render(<EditPerformancePage />);
    expect((await screen.findByLabelText('공연명') as HTMLInputElement).value).toBe('가을 리사이틀');
    fireEvent.change(screen.getByLabelText('공연명'), { target: { value: '수정됨' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(putBff).toHaveBeenCalledWith('/api/bff/performances/1', expect.objectContaining({ title: '수정됨' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/1'));
  });

  it('주최자가 아니면 상세로 돌려보낸다', async () => {
    getBff.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/bff/me/identity')) return { ok: true, data: { id: 9, nickname: '남', role: 'USER', verified: false }, message: null };
      if (path === '/api/bff/performances/1') return { ok: true, data: perf, message: null };
      return { ok: false, message: 'x' };
    });
    render(<EditPerformancePage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/1'));
  });

  it('포스터 파일 선택 시 즉시 업로드', async () => {
    putBffForm.mockResolvedValue({ ok: true, data: { ...perf, posterImageUrl: 'http://x/p.png' }, message: null });
    render(<EditPerformancePage />);
    await screen.findByLabelText('공연명');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    await waitFor(() => expect(putBffForm).toHaveBeenCalledWith('/api/bff/performances/1/poster', expect.any(FormData)));
  });
});
