import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportItemList } from '@/components/imports/ImportItemList';
import { ImportSourceStatus } from '@/components/imports/ImportSourceStatus';
import type { ImportedItem, ImportRunStatus } from '@/lib/imports/types';

const item: ImportedItem = {
  id: 1,
  source: 'KOPIS',
  sourceKey: 'p-1',
  sourceName: 'KOPIS',
  sourceUrl: 'https://example.com/source',
  title: '가을 실내악 공연',
  startsAt: '2026-09-26T19:30:00',
  endsAt: null,
  postedAt: '2026-09-12T09:00:00',
  place: '예술의전당',
  summary: '공연 소개',
  posterUrl: null,
  status: 'NEW',
  noticeId: null,
  lastSeenAt: '2026-09-15T09:00:00',
  createdAt: '2026-09-12T09:00:00',
};

describe('IMPORT 운영 화면 컴포넌트', () => {
  it('후보 행에 원천, 게시일, 일정, 상태와 심사 액션을 함께 보여준다', () => {
    render(<ImportItemList items={[item]} onApprove={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText('가을 실내악 공연')).toBeInTheDocument();
    expect(screen.getByText(/게시일/)).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.26/)).toBeInTheDocument();
    expect(screen.getByText('검토 대기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '승인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '거절' })).toBeInTheDocument();
  });

  it('실행 중인 원천은 실행 중 상태와 진행 정보를 구분해 보여준다', () => {
    const run: ImportRunStatus = {
      id: 1, source: 'KOPIS', trigger: 'ADMIN', result: 'RUNNING',
      startedAt: '2026-09-15T09:00:00', finishedAt: null, newCount: 0, message: null, running: true,
    };

    render(<ImportSourceStatus source="KOPIS" run={run} pending={false} onRun={vi.fn()} />);

    expect(screen.getAllByText('실행 중')).toHaveLength(2);
    expect(screen.getByText(/새 항목 0건/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '실행 중' })).toBeDisabled();
  });
});
