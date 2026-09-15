import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

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

  it('카드의 모집 파트를 enum명이 아니라 한글 라벨로 보여준다', async () => {
    // 예전에는 "PIANO"가 그대로 노출됐다. 옵션은 이미 화면이 받아오고 있었는데 카드에 안 내려줬다.
    render(<RecruitmentsPage />);
    await screen.findByText('공고1');
    // 필터 <select>에도 "피아노"가 있으므로 카드 안으로 좁힌다.
    const card = screen.getByRole('article');
    expect(within(card).getByText(/피아노/)).toBeInTheDocument();
    expect(within(card).queryByText(/PIANO/)).not.toBeInTheDocument();
  });

  it('악기 필터 선택 시 instrument 쿼리로 재조회', async () => {
    render(<RecruitmentsPage />);
    await screen.findByText('공고1');
    fireEvent.change(screen.getByLabelText('모집 파트'), { target: { value: 'PIANO' } });
    await waitFor(() => expect(getBff.mock.calls.some((c) => String(c[0]).includes('instrument=PIANO'))).toBe(true));
  });

  it('모집 상태는 접근 가능한 탭으로 표시하고 선택 상태를 전달한다', async () => {
    render(<RecruitmentsPage />);

    const tablist = screen.getByRole('tablist', { name: '모집 상태' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '모집중' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: '마감' }));
    expect(screen.getByRole('tab', { name: '마감' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '모집중' })).toHaveAttribute('aria-selected', 'false');
  });

  it('악기 필터와 내 지원 현황을 모바일에서도 구분 가능한 이름으로 제공한다', async () => {
    render(<RecruitmentsPage />);
    await screen.findByText('공고1');

    expect(screen.getByLabelText('모집 파트')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '내 지원 현황' })).toHaveClass('w-full');
  });
});
