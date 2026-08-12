import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useParams: () => ({ id: '7' }) }));
const getBff = vi.fn(); const putBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), putBff: (p: string, b: unknown) => putBff(p, b) }));

import EditRecruitmentPage from '@/app/recruitments/[id]/edit/page';

const posting = { id: 7, author: { id: 9, nickname: 'A', verified: false }, title: '기존공고',
  description: null, instruments: ['PIANO'], recruitCount: 1, location: '서울', fee: null,
  deadline: null, status: 'OPEN', closed: false, createdAt: '', updatedAt: '' };

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); putBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('EditRecruitmentPage', () => {
  it('기존 값 채우고 저장 시 PUT 후 상세로', async () => {
    putBff.mockResolvedValue({ ok: true, data: posting });
    render(<EditRecruitmentPage />);
    expect((await screen.findByLabelText('제목') as HTMLInputElement).value).toBe('기존공고');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(putBff).toHaveBeenCalledWith('/api/bff/recruitments/7', expect.objectContaining({ title: '기존공고' })));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recruitments/7'));
  });

  it('작성자가 아니면 상세로 되돌림', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 999, nickname: 'B', role: 'USER', verified: false } });
      if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [] } });
      if (p === '/api/bff/recruitments/7') return Promise.resolve({ ok: true, data: posting });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<EditRecruitmentPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/recruitments/7'));
  });
});
