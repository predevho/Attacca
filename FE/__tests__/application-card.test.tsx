import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationCard } from '@/components/recruitment/ApplicationCard';
import type { Application } from '@/lib/recruitment/types';

const pending: Application = { id: 1, postingId: 7, applicant: { id: 2, nickname: '나', verified: false },
  message: '지원합니다', status: 'PENDING', createdAt: '', updatedAt: '' };

describe('ApplicationCard', () => {
  it('상태·메시지 표시 + 공고 링크', () => {
    render(<ApplicationCard application={pending} onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('대기 중')).toBeInTheDocument();
    expect(screen.getByText('지원합니다')).toBeInTheDocument();
  });

  it('PENDING이면 철회 버튼, 클릭 시 onWithdraw(id)', () => {
    const onWithdraw = vi.fn();
    render(<ApplicationCard application={pending} onWithdraw={onWithdraw} onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '철회' }));
    expect(onWithdraw).toHaveBeenCalledWith(1);
  });

  it('ACCEPTED면 철회 버튼 없음', () => {
    render(<ApplicationCard application={{ ...pending, status: 'ACCEPTED' }} onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: '철회' })).not.toBeInTheDocument();
  });
});
