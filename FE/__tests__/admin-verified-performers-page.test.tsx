import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

import AdminVerifiedPerformersPage from '@/app/admin/verified-performers/page';

const pageData = { content: [{ id: 1, memberId: 5, statement: '5년', evidenceUrls: [], status: 'PENDING',
  decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '' }], number: 0, totalPages: 1, last: true };

function mockAdmin(role: 'ADMIN' | 'USER') {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 9, nickname: 'Adm', role, verified: false } });
    if (p.startsWith('/api/bff/admin/verified-performers/applications')) return Promise.resolve({ ok: true, data: pageData });
    return Promise.resolve({ ok: false, message: 'x' });
  });
}

beforeEach(() => { push.mockReset(); getBff.mockReset(); postBff.mockReset(); });

describe('AdminVerifiedPerformersPage', () => {
  it('비어드민이면 대시보드로 리다이렉트', async () => {
    mockAdmin('USER');
    render(<AdminVerifiedPerformersPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('어드민이면 목록 렌더', async () => {
    mockAdmin('ADMIN');
    render(<AdminVerifiedPerformersPage />);
    expect(await screen.findByText(/회원 #5/)).toBeInTheDocument();
  });

  it('승인 클릭 시 approve BFF 호출', async () => {
    mockAdmin('ADMIN');
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<AdminVerifiedPerformersPage />);
    fireEvent.click(await screen.findByRole('button', { name: '승인' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/verified-performers/applications/1/approve'));
  });

  it('직접지정 제출 시 grant BFF 호출', async () => {
    mockAdmin('ADMIN');
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<AdminVerifiedPerformersPage />);
    await screen.findByText(/회원 #5/);
    fireEvent.change(screen.getByLabelText('회원 id'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '직접지정' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/verified-performers/grant', { memberId: 7, reason: null }));
  });

  it('비로그인이면 로그인으로 리다이렉트', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: false, message: 'x' });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<AdminVerifiedPerformersPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });

  it('거절 인라인 사유 제출 시 reject BFF 호출', async () => {
    mockAdmin('ADMIN');
    postBff.mockResolvedValue({ ok: true, data: null });
    render(<AdminVerifiedPerformersPage />);
    fireEvent.click(await screen.findByRole('button', { name: '거절' }));
    fireEvent.change(screen.getByLabelText('처리 사유'), { target: { value: '증빙 부족' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/verified-performers/applications/1/reject', { reason: '증빙 부족' }));
  });
});
