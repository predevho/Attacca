import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { LikeButton } from '@/components/feed/LikeButton';
import { ComposeForm } from '@/components/feed/ComposeForm';

describe('AuthorBadge', () => {
  it('verified면 인증 뱃지를 보여준다', () => {
    render(<AuthorBadge author={{ id: 1, nickname: '연주자', verified: true }} />);
    expect(screen.getByText('연주자')).toBeInTheDocument();
    expect(screen.getByText('인증')).toBeInTheDocument();
  });
  it('verified 아니면 뱃지가 없다', () => {
    render(<AuthorBadge author={{ id: 1, nickname: '일반', verified: false }} />);
    expect(screen.queryByText('인증')).not.toBeInTheDocument();
  });
});

describe('LikeButton', () => {
  it('클릭하면 onToggle을 호출한다', () => {
    const onToggle = vi.fn();
    render(<LikeButton liked={false} count={2} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('ComposeForm', () => {
  it('빈값이면 제출하지 않는다', () => {
    const onSubmit = vi.fn(async () => true);
    render(<ComposeForm placeholder="무슨 생각" maxLength={2000} buttonLabel="게시" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '게시' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('내용을 입력하고 제출하면 onSubmit 호출 후 입력을 비운다', async () => {
    const onSubmit = vi.fn(async () => true);
    render(<ComposeForm placeholder="무슨 생각" maxLength={2000} buttonLabel="게시" onSubmit={onSubmit} />);
    const ta = screen.getByPlaceholderText('무슨 생각') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '첫 글' } });
    fireEvent.click(screen.getByRole('button', { name: '게시' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('첫 글'));
    await waitFor(() => expect(ta.value).toBe(''));
  });
});
