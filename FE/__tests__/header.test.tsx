import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
let pathname = '/feed';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const getBff = vi.fn();
const postBff = vi.fn();
vi.mock('@/lib/api', () => ({
  getBff: (...a: unknown[]) => getBff(...a),
  postBff: (...a: unknown[]) => postBff(...a),
}));

import { Header } from '@/components/layout/Header';

const ME = { id: 1, nickname: '스모크1', role: 'USER', verified: true };

beforeEach(() => {
  vi.clearAllMocks();
  pathname = '/feed';
  getBff.mockResolvedValue({ ok: true, data: ME, message: null });
  postBff.mockResolvedValue({ ok: true, message: null });
});

describe('Header', () => {
  it('도메인 링크 4개와 닉네임을 보여준다', async () => {
    render(<Header />);
    expect(await screen.findByRole('link', { name: '피드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '공연' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '구인' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '채팅' })).toBeInTheDocument();
    expect(screen.getByText('스모크1')).toBeInTheDocument();
  });

  it('현재 경로의 링크에 aria-current를 붙인다', async () => {
    pathname = '/recruitments/3/edit';
    render(<Header />);
    const active = await screen.findByRole('link', { name: '구인' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '피드' })).not.toHaveAttribute('aria-current');
  });

  it('인증 회원에게 인증 뱃지를 보여준다', async () => {
    render(<Header />);
    expect(await screen.findByText('인증')).toBeInTheDocument();
  });

  it('ADMIN에게만 어드민 링크를 보여준다', async () => {
    getBff.mockResolvedValue({ ok: true, data: { ...ME, role: 'ADMIN' }, message: null });
    render(<Header />);
    expect(await screen.findByRole('link', { name: '어드민' })).toBeInTheDocument();
  });

  it('일반 회원에게는 어드민 링크를 보여주지 않는다', async () => {
    render(<Header />);
    await screen.findByText('스모크1');
    expect(screen.queryByRole('link', { name: '어드민' })).not.toBeInTheDocument();
  });

  it('신원 조회에 실패하면 아무것도 렌더하지 않는다', async () => {
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    const { container } = render(<Header />);
    await waitFor(() => expect(getBff).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('fetch가 reject해도 죽지 않고 렌더만 건너뛴다', async () => {
    getBff.mockRejectedValue(new Error('network'));
    const { container } = render(<Header />);
    await waitFor(() => expect(getBff).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('로그인 화면에서는 렌더하지 않고 신원 조회도 하지 않는다', async () => {
    pathname = '/login';
    const { container } = render(<Header />);
    expect(container).toBeEmptyDOMElement();
    expect(getBff).not.toHaveBeenCalled();
  });

  it('로그아웃하면 BFF를 호출하고 /login으로 보낸다', async () => {
    render(<Header />);
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/logout'));
    expect(push).toHaveBeenCalledWith('/login');
  });
});
