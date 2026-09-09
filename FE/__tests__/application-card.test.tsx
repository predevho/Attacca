import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationCard } from '@/components/recruitment/ApplicationCard';
import type { Application } from '@/lib/recruitment/types';

const pending: Application = { id: 1, postingId: 7, postingTitle: '첼로 구함', applicant: { id: 2, nickname: '나', verified: false },
  message: '지원합니다', status: 'PENDING', createdAt: '', updatedAt: '' };

describe('ApplicationCard', () => {
  it('상태·메시지 표시 + 공고 링크', () => {
    render(<ApplicationCard application={pending} onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.getByText('대기 중')).toBeInTheDocument();
    expect(screen.getByText('지원합니다')).toBeInTheDocument();
  });

  it('공고를 번호가 아니라 제목으로 보여준다', () => {
    // "공고 #1"로만 보이면 지원이 여러 건일 때 뭐가 뭔지 알 수 없다(2026-09-09 화면에서 확인).
    render(<ApplicationCard application={pending} onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: '첼로 구함' })).toBeInTheDocument();
  });

  it('삭제된 공고는 번호로 떨어지되 삭제됐음을 알린다', () => {
    render(<ApplicationCard application={{ ...pending, postingTitle: null }}
      onWithdraw={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole('button', { name: '공고 #7 (삭제됨)' })).toBeInTheDocument();
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
