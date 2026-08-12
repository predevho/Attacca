import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyStatusCard } from '@/components/verification/MyStatusCard';
import type { Application } from '@/lib/verification/types';

const app: Application = {
  id: 1, memberId: 2, statement: '5년 활동', evidenceUrls: ['http://a'],
  status: 'PENDING', decisionReason: null, decidedBy: null, decidedAt: null, createdAt: '2026-08-01T00:00',
};

describe('MyStatusCard', () => {
  it('PENDING이면 심사 중 문구', () => {
    render(<MyStatusCard application={app} />);
    expect(screen.getByText(/심사 중/)).toBeInTheDocument();
    expect(screen.getByText('5년 활동')).toBeInTheDocument();
  });

  it('APPROVED이면 승인 문구', () => {
    render(<MyStatusCard application={{ ...app, status: 'APPROVED' }} />);
    expect(screen.getByText(/승인/)).toBeInTheDocument();
  });

  it('REJECTED이면 사유 표시', () => {
    render(<MyStatusCard application={{ ...app, status: 'REJECTED', decisionReason: '증빙 부족' }} />);
    expect(screen.getByText('증빙 부족')).toBeInTheDocument();
  });
});
