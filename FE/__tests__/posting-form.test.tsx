import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostingForm } from '@/components/recruitment/PostingForm';

const options = [{ code: 'PIANO', label: '피아노' }];

describe('PostingForm', () => {
  it('제목/악기 누락 시 onSubmit 미호출 + 에러', () => {
    const onSubmit = vi.fn();
    render(<PostingForm options={options} submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('제목을 입력해 주세요.')).toBeInTheDocument();
  });

  it('유효 입력이면 폼 값과 함께 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<PostingForm options={options} submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '반주자 구함' } });
    fireEvent.click(screen.getByText('피아노')); // 악기 선택
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: '반주자 구함', instruments: ['PIANO'] }));
  });

  it('initial 값으로 필드를 채운다', () => {
    render(<PostingForm options={options} submitting={false} submitLabel="저장"
      initial={{ title: '기존제목', instruments: ['PIANO'] }} onSubmit={() => {}} />);
    expect((screen.getByLabelText('제목') as HTMLInputElement).value).toBe('기존제목');
  });
});
