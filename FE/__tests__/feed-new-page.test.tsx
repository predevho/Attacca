import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const getBff = vi.fn();
const postBff = vi.fn();
const postBffForm = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api', () => ({
  getBff: (...args: unknown[]) => getBff(...args),
  postBff: (...args: unknown[]) => postBff(...args),
  postBffForm: (...args: unknown[]) => postBffForm(...args),
}));

import FeedNewPage from '@/app/feed/new/page';

beforeEach(() => {
  vi.clearAllMocks();
  getBff.mockResolvedValue({ ok: true, data: { id: 5 }, message: null });
});

describe('피드 작성 화면', () => {
  it('본문과 빈 첨부 ID 목록을 전송하고 생성된 상세로 이동한다', async () => {
    postBff.mockResolvedValue({ ok: true, data: { id: 9 }, message: null });
    render(<FeedNewPage />);

    await screen.findByRole('textbox', { name: '게시글 내용' });
    fireEvent.change(screen.getByRole('textbox', { name: '게시글 내용' }), { target: { value: '새글' } });
    fireEvent.click(screen.getByRole('button', { name: '게시' }));

    await waitFor(() => expect(postBff).toHaveBeenCalledWith('/api/bff/feed/posts', {
      content: '새글', attachmentIds: [],
    }));
    expect(push).toHaveBeenCalledWith('/feed/9');
  });
});
