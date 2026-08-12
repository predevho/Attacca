import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

import MyApplicationsPage from '@/app/recruitments/applications/me/page';

const page = { content: [{ id: 1, postingId: 7, applicant: { id: 2, nickname: '나', verified: false },
  message: '지원합니다', status: 'PENDING', createdAt: '', updatedAt: '' }], number: 0, totalPages: 1, last: true };

beforeEach(() => {
  push.mockReset(); getBff.mockReset(); postBff.mockReset();
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: '나', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/recruitments/applications/me')) return Promise.resolve({ ok: true, data: page });
    return Promise.resolve({ ok: false, message: 'x' });
  });
});

describe('MyApplicationsPage', () => {
  it('내 지원 목록 렌더', async () => {
    render(<MyApplicationsPage />);
    expect(await screen.findByText('지원합니다')).toBeInTheDocument();
  });

  it('철회 성공 시 상태가 철회됨으로', async () => {
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<MyApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '철회' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/recruitments/applications/1/withdraw'));
    expect(await screen.findByText('철회됨')).toBeInTheDocument();
  });

  it('공고 링크 클릭 시 상세로 push', async () => {
    render(<MyApplicationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /공고 #7/ }));
    expect(push).toHaveBeenCalledWith('/recruitments/7');
  });
});
