import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyPanel } from '@/components/recruitment/ApplyPanel';

describe('ApplyPanel', () => {
  it('처음엔 지원하기 버튼만, 클릭 시 메시지 입력 펼침', () => {
    render(<ApplyPanel submitting={false} applied={false} onApply={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '지원하기' }));
    expect(screen.getByLabelText('지원 메시지')).toBeInTheDocument();
  });

  it('메시지 입력 후 제출 시 onApply(message)', () => {
    const onApply = vi.fn();
    render(<ApplyPanel submitting={false} applied={false} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: '지원하기' }));
    fireEvent.change(screen.getByLabelText('지원 메시지'), { target: { value: '함께하고 싶어요' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onApply).toHaveBeenCalledWith('함께하고 싶어요');
  });

  it('빈 메시지는 제출 막고 에러', () => {
    const onApply = vi.fn();
    render(<ApplyPanel submitting={false} applied={false} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: '지원하기' }));
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/메시지/)).toBeInTheDocument();
  });

  it('applied=true면 지원 완료 표시', () => {
    render(<ApplyPanel submitting={false} applied={true} onApply={() => {}} />);
    expect(screen.getByText('지원 완료')).toBeInTheDocument();
  });
});
