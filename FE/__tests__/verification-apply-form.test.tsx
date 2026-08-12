import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyForm } from '@/components/verification/ApplyForm';

describe('ApplyForm', () => {
  it('사유 없으면 onSubmit 미호출 + 에러', () => {
    const onSubmit = vi.fn();
    render(<ApplyForm submitting={false} submitLabel="신청" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('지원 사유를 입력해 주세요.')).toBeInTheDocument();
  });

  it('유효 입력이면 폼 값과 함께 onSubmit', () => {
    const onSubmit = vi.fn();
    render(<ApplyForm submitting={false} submitLabel="신청" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('지원 사유'), { target: { value: '5년 활동' } });
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    expect(onSubmit).toHaveBeenCalledWith({ statement: '5년 활동', evidenceUrls: [] });
  });
});
