import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const getBff = vi.fn();
const postBff = vi.fn();
const putBff = vi.fn();
const deleteBff = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({
  getBff: (path: string) => getBff(path),
  postBff: (...args: unknown[]) => postBff(...args),
  putBff: (...args: unknown[]) => putBff(...args),
  deleteBff: (...args: unknown[]) => deleteBff(...args),
}));

import AdminNoticesPage from '@/app/admin/notices/page';

const notice = {
  id: 1,
  type: 'NOTICE' as const,
  title: '모바일에서도 제목과 액션이 겹치지 않는 공지',
  content: '내용',
  scheduledAt: '2026-09-15T10:00:00',
  place: '연습실',
  pinned: true,
  coverImageUrl: null,
  createdAt: '',
  updatedAt: '',
  sourceName: null,
  sourceUrl: null,
};

function mockAdmin(result: unknown = { ok: true, data: { content: [notice] } }) {
  getBff.mockImplementation((path: string) => {
    if (path === '/api/bff/me/identity') return Promise.resolve({ ok: true, data: { role: 'ADMIN' } });
    return Promise.resolve(result);
  });
}

beforeEach(() => {
  push.mockReset();
  getBff.mockReset();
  postBff.mockReset();
  putBff.mockReset();
  deleteBff.mockReset();
});

describe('AdminNoticesPage', () => {
  it('공지 목록을 불러오는 동안 로딩 상태를 알린다', async () => {
    let resolveList: ((value: unknown) => void) | undefined;
    getBff.mockImplementation((path: string) => {
      if (path === '/api/bff/me/identity') return Promise.resolve({ ok: true, data: { role: 'ADMIN' } });
      return new Promise((resolve) => { resolveList = resolve; });
    });
    render(<AdminNoticesPage />);

    expect(await screen.findByRole('status')).toHaveTextContent('불러오는 중...');
    resolveList?.({ ok: true, data: { content: [] } });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('목록 항목의 제목, 일정, 액션을 모바일에서도 독립된 영역으로 제공한다', async () => {
    mockAdmin();
    render(<AdminNoticesPage />);

    const item = await screen.findByRole('listitem');
    expect(item).toHaveClass('grid');
    expect(screen.getByRole('heading', { name: notice.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `"${notice.title}" 수정` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `"${notice.title}" 삭제` })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '공지 작업' })).toBeInTheDocument();
  });

  it('공지 목록 조회 실패 시 오류와 다시 시도 액션을 제공한다', async () => {
    mockAdmin({ ok: false, message: '네트워크 오류' });
    render(<AdminNoticesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 오류');
    expect(screen.getByRole('button', { name: '공지 목록 다시 시도' })).toBeInTheDocument();
  });

  it('공지 목록이 비어 있으면 빈 상태를 제공한다', async () => {
    mockAdmin({ ok: true, data: { content: [] } });
    render(<AdminNoticesPage />);

    expect(await screen.findByText('등록된 공지가 없습니다.')).toBeInTheDocument();
  });

  it('삭제 액션은 기존 CRUD 엔드포인트를 호출한다', async () => {
    mockAdmin();
    deleteBff.mockResolvedValue({ ok: true, data: null });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminNoticesPage />);

    fireEvent.click(await screen.findByRole('button', { name: `"${notice.title}" 삭제` }));
    await waitFor(() => expect(deleteBff).toHaveBeenCalledWith('/api/bff/admin/notices/1'));
  });
});
