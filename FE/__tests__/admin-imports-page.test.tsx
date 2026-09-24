import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const getBff = vi.fn();
const postBff = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({
  getBff: (path: string) => getBff(path),
  postBff: (path: string) => postBff(path),
}));

import AdminImportsPage from '@/app/admin/imports/page';

const kopisRun = {
  id: 1,
  source: 'KOPIS',
  trigger: 'MANUAL',
  result: 'SUCCESS',
  startedAt: '2026-09-23T12:00:00',
  finishedAt: '2026-09-23T12:01:00',
  newCount: 3,
  message: null,
};

describe('AdminImportsPage', () => {
  beforeEach(() => {
    push.mockReset();
    getBff.mockReset();
    postBff.mockReset();
    postBff.mockResolvedValue({ ok: true, data: { source: 'UNIV_NOTICE', status: 'ACCEPTED' }, message: null });
    getBff.mockImplementation((path: string) => {
      if (path === '/api/bff/me/identity') {
        return Promise.resolve({ ok: true, data: { role: 'ADMIN' }, message: null });
      }
      if (path.startsWith('/api/bff/admin/imports?')) {
        return Promise.resolve({ ok: true, data: { content: [] }, message: null });
      }
      if (path === '/api/bff/admin/imports/runs/latest?source=KOPIS') {
        return Promise.resolve({ ok: true, data: kopisRun, message: null });
      }
      if (path === '/api/bff/admin/imports/runs/latest?source=UNIV_NOTICE') {
        return Promise.resolve({ ok: true, data: null, message: null });
      }
      return Promise.resolve({ ok: false, data: null, message: 'unexpected request' });
    });
  });

  it('원천별 최신 실행 상태가 하나만 있어도 심사 화면을 렌더링한다', async () => {
    render(<AdminImportsPage />);

    expect(await screen.findByText('완료')).toBeInTheDocument();
    expect(screen.getByText('실행 기록 없음')).toBeInTheDocument();
    expect(screen.getByText(/새 항목 3건/)).toBeInTheDocument();
  });

  it('수집 요청 뒤 실행 기록이 생길 때까지 원천 상태를 다시 확인한다', async () => {
    let runRecorded = false;
    getBff.mockImplementation((path: string) => {
      if (path === '/api/bff/me/identity') {
        return Promise.resolve({ ok: true, data: { role: 'ADMIN' }, message: null });
      }
      if (path.startsWith('/api/bff/admin/imports?')) {
        return Promise.resolve({ ok: true, data: { content: [] }, message: null });
      }
      if (path === '/api/bff/admin/imports/runs/latest?source=KOPIS') {
        return Promise.resolve({ ok: true, data: null, message: null });
      }
      if (path === '/api/bff/admin/imports/runs/latest?source=UNIV_NOTICE') {
        return Promise.resolve({
          ok: true,
          data: runRecorded ? { ...kopisRun, source: 'UNIV_NOTICE', newCount: 2 } : null,
          message: null,
        });
      }
      return Promise.resolve({ ok: false, data: null, message: 'unexpected request' });
    });
    render(<AdminImportsPage />);

    const runButtons = await screen.findAllByRole('button', { name: '지금 가져오기' });
    fireEvent.click(runButtons[1]);

    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/imports/runs?source=UNIV_NOTICE'));
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    runRecorded = true;
    await waitFor(() => expect(screen.getByText('완료')).toBeInTheDocument(), { timeout: 2_000 });
    expect(screen.getByText(/새 항목 2건/)).toBeInTheDocument();
  });

  it('KOPIS 수집 요청 뒤에는 KOPIS 실행 상태만 다시 확인한다', async () => {
    render(<AdminImportsPage />);

    await screen.findByText('완료');
    const initialUniversityRequests = getBff.mock.calls
      .filter(([path]) => path === '/api/bff/admin/imports/runs/latest?source=UNIV_NOTICE').length;

    fireEvent.click((await screen.findAllByRole('button', { name: '지금 가져오기' }))[0]);

    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/admin/imports/runs?source=KOPIS'));
    await waitFor(() => expect(getBff).toHaveBeenCalledWith('/api/bff/admin/imports/runs/latest?source=KOPIS'));
    expect(getBff.mock.calls
      .filter(([path]) => path === '/api/bff/admin/imports/runs/latest?source=UNIV_NOTICE')).toHaveLength(initialUniversityRequests);
  });
});
