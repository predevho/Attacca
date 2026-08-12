import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplicationReviewItem } from '@/components/verification/ApplicationReviewItem';
import type { Application } from '@/lib/verification/types';

const pending: Application = {
  id: 1, memberId: 5, statement: '5년 활동', evidenceUrls: ['http://a'],
  status: 'PENDING', decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '2026-08-01T00:00',
};

function handlers() { return { onApprove: vi.fn(), onReject: vi.fn(), onRevoke: vi.fn() }; }

describe('ApplicationReviewItem', () => {
  it('회원 id·사유 표시', () => {
    render(<ApplicationReviewItem application={pending} {...handlers()} />);
    expect(screen.getByText(/회원 #5/)).toBeInTheDocument();
    expect(screen.getByText('5년 활동')).toBeInTheDocument();
  });

  it('PENDING: 승인 클릭 시 즉시 onApprove(id)', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={pending} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(h.onApprove).toHaveBeenCalledWith(1);
  });

  it('PENDING: 거절은 사유 펼침 후 제출 시 onReject(id, reason)', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={pending} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: '거절' }));
    fireEvent.change(screen.getByLabelText('처리 사유'), { target: { value: '증빙 부족' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(h.onReject).toHaveBeenCalledWith(1, '증빙 부족');
  });

  it('거절 사유 비면 제출 막고 에러', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={pending} {...h} />);
    fireEvent.click(screen.getByRole('button', { name: '거절' }));
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(h.onReject).not.toHaveBeenCalled();
    expect(screen.getByText(/사유/)).toBeInTheDocument();
  });

  it('APPROVED: 철회만 노출, 제출 시 onRevoke(id, reason)', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={{ ...pending, status: 'APPROVED' }} {...h} />);
    expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '철회' }));
    fireEvent.change(screen.getByLabelText('처리 사유'), { target: { value: '자격 상실' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(h.onRevoke).toHaveBeenCalledWith(1, '자격 상실');
  });

  it('REJECTED: 액션 없음, 사유 표시', () => {
    const h = handlers();
    render(<ApplicationReviewItem application={{ ...pending, status: 'REJECTED', decisionReason: '부족' }} {...h} />);
    expect(screen.queryByRole('button', { name: '승인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '거절' })).not.toBeInTheDocument();
    expect(screen.getByText('부족')).toBeInTheDocument();
  });
});
