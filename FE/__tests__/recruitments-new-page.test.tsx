import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (p: string, b: unknown) => postBff(p, b) }));

import NewRecruitmentPage from '@/app/recruitments/new/page';

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); postBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('NewRecruitmentPage', () => {
  it('등록 성공 시 상세로 이동', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 42 } });
    render(<NewRecruitmentPage />);
    fireEvent.change(await screen.findByLabelText('제목'), { target: { value: '반주자 구함' } });
    fireEvent.click(screen.getByText('피아노'));
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recruitments/42'));
  });

  it('등록 실패 시 에러 노출', async () => {
    postBff.mockResolvedValue({ ok: false, message: '등록 실패' });
    render(<NewRecruitmentPage />);
    fireEvent.change(await screen.findByLabelText('제목'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('피아노'));
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(await screen.findByText('등록 실패')).toBeInTheDocument();
  });
});
