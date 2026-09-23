import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const push = vi.fn();
const replace = vi.fn();
let pathname = '/feed';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
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
    expect(screen.getAllByText('스모크1')).not.toHaveLength(0);
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
    expect((await screen.findAllByText('인증')).length).toBeGreaterThan(0);
  });

  it('ADMIN에게만 관리 허브 링크를 보여준다', async () => {
    getBff.mockResolvedValue({ ok: true, data: { ...ME, role: 'ADMIN' }, message: null });
    render(<Header />);

    expect(await screen.findByRole('link', { name: '관리' })).toHaveAttribute('href', '/admin');
    expect(screen.queryByRole('link', { name: '공지' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '인증심사' })).not.toBeInTheDocument();
  });

  it('관리자 화면에서는 관리 링크를 활성 상태로 표시한다', async () => {
    pathname = '/admin/imports';
    getBff.mockResolvedValue({ ok: true, data: { ...ME, role: 'ADMIN' }, message: null });
    render(<Header />);

    const management = await screen.findByRole('link', { name: '관리' });
    expect(management).toHaveAttribute('aria-current', 'page');
    expect(management).toHaveClass('bg-brand');
  });

  it('일반 회원에게는 어드민 화면 링크를 보여주지 않는다', async () => {
    render(<Header />);
    await screen.findAllByText('스모크1');
    expect(screen.queryByRole('link', { name: '관리' })).not.toBeInTheDocument();
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

  it('로그인 화면에서도 브랜드와 최소 내비게이션을 렌더링한다', async () => {
    pathname = '/login';
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Attacca' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '로그인' })).toBeInTheDocument();
  });

  it('경로가 바뀌면 로그인 신원을 다시 읽는다', async () => {
    pathname = '/login';
    getBff.mockResolvedValue({ ok: false, message: '인증 필요' });
    const view = render(<Header />);
    await screen.findByRole('link', { name: '로그인' });

    pathname = '/';
    getBff.mockResolvedValue({ ok: true, data: ME, message: null });
    view.rerender(<Header />);

    expect(await screen.findAllByText('스모크1')).not.toHaveLength(0);
    expect(getBff).toHaveBeenCalledTimes(2);
  });

  it('로그아웃하면 BFF를 호출하고 /login으로 보낸다', async () => {
    render(<Header />);
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/logout'));
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument();
  });

  it('테마 control이 현재 모드와 다음 모드를 접근 가능하게 노출한다', async () => {
    render(<Header />);
    expect(await screen.findByRole('button', { name: /라이트 테마/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '라이트 테마' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다크 테마' })).not.toBeInTheDocument();
  });
});
