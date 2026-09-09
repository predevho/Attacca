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

  it('ADMIN에게만 어드민 화면 링크를 보여준다', async () => {
    // 어드민 화면이 둘(공지 관리 / 인증 심사)이라 링크도 둘이다.
    getBff.mockResolvedValue({ ok: true, data: { ...ME, role: 'ADMIN' }, message: null });
    render(<Header />);

    expect(await screen.findByRole('link', { name: '공지' })).toHaveAttribute('href', '/admin/notices');
    expect(screen.getByRole('link', { name: '인증심사' }))
      .toHaveAttribute('href', '/admin/verified-performers');
  });

  it('일반 회원에게는 어드민 화면 링크를 보여주지 않는다', async () => {
    render(<Header />);
    await screen.findByText('스모크1');
    expect(screen.queryByRole('link', { name: '공지' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '인증심사' })).not.toBeInTheDocument();
  });

  it('비로그인이면 로그인·회원가입을 보여준다', async () => {
    // 홈이 공개 랜딩이 되면서 바뀐 동작. 예전에는 아무것도 렌더하지 않아
    // 공개 홈에 헤더가 사라지고 로그인할 방법이 없었다.
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    render(<Header />);
    expect(await screen.findByRole('link', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '회원가입' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('비로그인에게도 내비게이션은 그대로 보여준다', async () => {
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    render(<Header />);
    await screen.findByRole('link', { name: '로그인' });
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '공연' })).toBeInTheDocument();
  });

  it('fetch가 reject해도 죽지 않고 비로그인으로 본다', async () => {
    getBff.mockRejectedValue(new Error('network'));
    render(<Header />);
    expect(await screen.findByRole('link', { name: '로그인' })).toBeInTheDocument();
  });

  it('신원을 아직 모르는 동안에는 로그인도 로그아웃도 보여주지 않는다', () => {
    // 상태가 번갈아 번쩍이지 않도록 오른쪽만 비워 둔다.
    getBff.mockReturnValue(new Promise(() => {}));
    render(<Header />);
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
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
