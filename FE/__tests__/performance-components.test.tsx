import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PerformanceForm } from '@/components/performance/PerformanceForm';
import { PerformanceCard } from '@/components/performance/PerformanceCard';
import type { Performance } from '@/lib/performance/types';

describe('PerformanceForm', () => {
  it('필수 누락이면 onSubmit 미호출하고 에러 표시', () => {
    const onSubmit = vi.fn();
    render(<PerformanceForm submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('공연명을 입력해 주세요.')).toBeInTheDocument();
  });

  it('유효 입력이면 값과 함께 onSubmit 호출', () => {
    const onSubmit = vi.fn();
    render(<PerformanceForm submitting={false} submitLabel="등록" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('공연명'), { target: { value: '가을 리사이틀' } });
    fireEvent.change(screen.getByLabelText('공연 일시'), { target: { value: '2026-09-01T19:30' } });
    fireEvent.change(screen.getByLabelText('장소'), { target: { value: '예술의전당' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: '가을 리사이틀', performedAt: '2026-09-01T19:30', venue: '예술의전당',
    }));
  });

  it('초기값을 채운다', () => {
    render(<PerformanceForm initial={{ title: '기존공연' }} submitting={false} submitLabel="저장" onSubmit={vi.fn()} />);
    expect((screen.getByLabelText('공연명') as HTMLInputElement).value).toBe('기존공연');
  });
});

describe('PerformanceCard', () => {
  const perf: Performance = {
    id: 1, organizer: { id: 5, nickname: '연주자', verified: true }, title: '가을 리사이틀',
    description: null, performedAt: '2026-09-01T19:30:00', venue: '예술의전당', program: null,
    ticketInfo: null, ticketUrl: null, posterImageUrl: null, createdAt: 'x', updatedAt: 'x',
  };
  it('제목/주최자/일시·장소를 보여주고 클릭 시 onOpen', () => {
    const onOpen = vi.fn();
    render(<PerformanceCard performance={perf} onOpen={onOpen} />);
    expect(screen.getByText('가을 리사이틀')).toBeInTheDocument();
    expect(screen.getByText('연주자')).toBeInTheDocument();
    expect(screen.getByText(/2026\.09\.01 19:30/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('가을 리사이틀'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
