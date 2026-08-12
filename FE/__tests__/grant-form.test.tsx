import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrantForm } from '@/components/verification/GrantForm';

describe('GrantForm', () => {
  it('빈 id면 onGrant 미호출 + 에러', () => {
    const onGrant = vi.fn();
    render(<GrantForm submitting={false} onGrant={onGrant} />);
    fireEvent.click(screen.getByRole('button', { name: '직접지정' }));
    expect(onGrant).not.toHaveBeenCalled();
    expect(screen.getByText(/회원/)).toBeInTheDocument();
  });

  it('유효 입력이면 onGrant(values)', () => {
    const onGrant = vi.fn();
    render(<GrantForm submitting={false} onGrant={onGrant} />);
    fireEvent.change(screen.getByLabelText('회원 id'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('사유(선택)'), { target: { value: '수상 이력' } });
    fireEvent.click(screen.getByRole('button', { name: '직접지정' }));
    expect(onGrant).toHaveBeenCalledWith({ memberId: '7', reason: '수상 이력' });
  });
});
