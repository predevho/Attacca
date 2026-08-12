import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p) }));

import RecruitmentsPage from '@/app/recruitments/page';

const page = { content: [{ id: 1, author: { id: 9, nickname: 'A', verified: false }, title: '공고1',
  description: null, instruments: ['PIANO'], recruitCount: 1, location: '서울', fee: null,
  deadline: null, status: 'OPEN', closed: false, createdAt: '', updatedAt: '' }], number: 0, totalPages: 1, last: true };

beforeEach(() => {
  push.mockReset(); getBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/profile-options')) return Promise.resolve({ ok: true, data: { instruments: [{ code: 'PIANO', label: '피아노' }] } });
    if (p.startsWith('/api/bff/recruitments')) return Promise.resolve({ ok: true, data: page });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('RecruitmentsPage', () => {
  it('로그인 회원이면 등록 버튼 노출 + 목록 렌더', async () => {
    render(<RecruitmentsPage />);
    expect(await screen.findByText('공고1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '공고 등록' })).toBeInTheDocument();
  });

  it('카드 클릭 시 상세로 push', async () => {
    render(<RecruitmentsPage />);
    fireEvent.click(await screen.findByText('공고1'));
    expect(push).toHaveBeenCalledWith('/recruitments/1');
  });

  it('악기 필터 선택 시 instrument 쿼리로 재조회', async () => {
    render(<RecruitmentsPage />);
    await screen.findByText('공고1');
    fireEvent.change(screen.getByLabelText('악기 필터'), { target: { value: 'PIANO' } });
    await waitFor(() => expect(getBff.mock.calls.some((c) => String(c[0]).includes('instrument=PIANO'))).toBe(true));
  });
});
