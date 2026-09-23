import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const getBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...args: unknown[]) => getBff(...args),
}));

import AdminPage from '@/app/admin/page';

const ADMIN = { id: 1, nickname: '관리자', role: 'ADMIN', verified: true };

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockResolvedValue({ ok: true, data: ADMIN, message: null });
});

describe('AdminPage', () => {
  it('관리자에게 운영 메뉴를 보여준다', async () => {
    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: '관리' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '공지 관리' })).toHaveAttribute('href', '/admin/notices');
    expect(screen.getByRole('link', { name: '외부 반입 심사' })).toHaveAttribute('href', '/admin/imports');
    expect(screen.getByRole('link', { name: '인증 심사' })).toHaveAttribute('href', '/admin/verified-performers');
  });

  it('일반 회원은 홈으로 이동시킨다', async () => {
    getBff.mockResolvedValue({ ok: true, data: { ...ADMIN, role: 'USER' }, message: null });
    render(<AdminPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('비로그인 사용자는 로그인으로 이동시킨다', async () => {
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    render(<AdminPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
