import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const getBff = vi.fn();
const postBff = vi.fn();
const putBffForm = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  postBff: (...a: unknown[]) => postBff(...a),
  putBffForm: (...a: unknown[]) => putBffForm(...a),
}));

import NewPerformancePage from '@/app/performances/new/page';

function fillValid() {
  fireEvent.change(screen.getByLabelText('공연명'), { target: { value: '가을 리사이틀' } });
  fireEvent.change(screen.getByLabelText('공연 일시'), { target: { value: '2026-09-01T19:30' } });
  fireEvent.change(screen.getByLabelText('장소'), { target: { value: '예술의전당' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockResolvedValue({ ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: true }, message: null });
});

describe('NewPerformancePage', () => {
  it('비자격이면 안내를 보여주고 폼을 감춘다', async () => {
    getBff.mockResolvedValue({ ok: true, data: { id: 5, nickname: '나', role: 'USER', verified: false }, message: null });
    render(<NewPerformancePage />);
    expect(await screen.findByText(/인증 연주자만/)).toBeInTheDocument();
    expect(screen.queryByLabelText('공연명')).not.toBeInTheDocument();
  });

  it('포스터 없이 등록하면 생성 후 상세로 이동', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 42 }, message: null });
    render(<NewPerformancePage />);
    await screen.findByLabelText('공연명');
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/performances', expect.objectContaining({ title: '가을 리사이틀' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/42'));
    expect(putBffForm).not.toHaveBeenCalled();
  });

  it('포스터를 골랐고 업로드 실패하면 posterFailed로 상세 이동', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 42 }, message: null });
    putBffForm.mockResolvedValue({ ok: false, message: 'x' });
    render(<NewPerformancePage />);
    await screen.findByLabelText('공연명');
    fillValid();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(putBffForm).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/performances/42?posterFailed=1'));
  });
});
