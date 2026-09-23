import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const push = vi.fn();
const getBff = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({
  getBff: (path: string) => getBff(path),
  postBff: vi.fn(),
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
});
