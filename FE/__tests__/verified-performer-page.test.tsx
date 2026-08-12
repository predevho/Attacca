import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const getBff = vi.fn(); const postBff = vi.fn();
vi.mock('@/lib/api', () => ({ getBff: (p: string) => getBff(p), postBff: (...a: unknown[]) => postBff(...a) }));

import VerifiedPerformerPage from '@/app/verified-performer/page';

function mockMe(application: unknown) {
  getBff.mockImplementation((p: string) => {
    if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'A', role: 'USER', verified: false } });
    if (p.startsWith('/api/bff/verified-performers/applications/me')) return Promise.resolve({ ok: true, data: application });
    return Promise.resolve({ ok: false, message: 'x' });
  });
}
const base = { id: 1, memberId: 2, statement: '5년', evidenceUrls: [], decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '' };

beforeEach(() => { push.mockReset(); getBff.mockReset(); postBff.mockReset(); });

describe('VerifiedPerformerPage', () => {
  it('이력 없으면 신청 폼', async () => {
    mockMe(null);
    render(<VerifiedPerformerPage />);
    expect(await screen.findByRole('button', { name: '신청' })).toBeInTheDocument();
  });

  it('PENDING이면 심사 중 카드(폼 없음)', async () => {
    mockMe({ ...base, status: 'PENDING' });
    render(<VerifiedPerformerPage />);
    expect(await screen.findByText(/심사 중/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '신청' })).not.toBeInTheDocument();
  });

  it('REJECTED이면 사유 + 재신청 폼', async () => {
    mockMe({ ...base, status: 'REJECTED', decisionReason: '증빙 부족' });
    render(<VerifiedPerformerPage />);
    expect(await screen.findByText('증빙 부족')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재신청' })).toBeInTheDocument();
  });

  it('신청 성공 시 상태 재조회', async () => {
    let call = 0;
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: true, data: { id: 2, nickname: 'A', role: 'USER', verified: false } });
      if (p.startsWith('/api/bff/verified-performers/applications/me')) {
        call += 1;
        return Promise.resolve({ ok: true, data: call === 1 ? null : { ...base, status: 'PENDING' } });
      }
      return Promise.resolve({ ok: false, message: 'x' });
    });
    postBff.mockResolvedValue({ ok: true, data: { ...base, status: 'PENDING' } });
    render(<VerifiedPerformerPage />);
    fireEvent.change(await screen.findByLabelText('지원 사유'), { target: { value: '5년' } });
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    await waitFor(() => expect(screen.getByText(/심사 중/)).toBeInTheDocument());
    expect(postBff).toHaveBeenCalledWith('/api/bff/verified-performers/applications', { statement: '5년', evidenceUrls: [] });
  });

  it('신청 실패(409) 시 BE 메시지 노출', async () => {
    mockMe(null);
    postBff.mockResolvedValue({ ok: false, message: '이미 신청 중입니다.' });
    render(<VerifiedPerformerPage />);
    fireEvent.change(await screen.findByLabelText('지원 사유'), { target: { value: '5년' } });
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    expect(await screen.findByText('이미 신청 중입니다.')).toBeInTheDocument();
  });

  it('비로그인이면 로그인으로 리다이렉트(폼 미노출)', async () => {
    getBff.mockImplementation((p: string) => {
      if (p.startsWith('/api/bff/me/identity')) return Promise.resolve({ ok: false, message: '로그인이 필요합니다.' });
      return Promise.resolve({ ok: false, message: 'x' });
    });
    render(<VerifiedPerformerPage />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(screen.queryByRole('button', { name: '신청' })).not.toBeInTheDocument();
  });
});
