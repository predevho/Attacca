import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monthRange, shiftMonth } from '@/lib/home/logic';

const { getBff } = vi.hoisted(() => ({ getBff: vi.fn() }));
vi.mock('@/lib/api', () => ({ getBff }));

import { useHomePageData } from '@/features/home/hooks/useHomePageData';

describe('useHomePageData', () => {
  beforeEach(() => {
    getBff.mockReset();
    getBff.mockImplementation((path: string) => {
      if (path.includes('/performances?scope=UPCOMING')) {
        return Promise.resolve({ ok: true, data: { content: [] } });
      }
      if (path.includes('/notices?scope=PINNED')) {
        return Promise.resolve({ ok: true, data: { content: [] } });
      }
      if (path.includes('/performances?scope=PAST')) {
        return Promise.resolve({ ok: true, data: { content: [] } });
      }
      if (path.includes('/feed/posts')) {
        return Promise.resolve({ ok: true, data: { content: [{ id: 1, content: '피드' }] } });
      }
      if (path.includes('/calendar')) {
        return Promise.resolve({ ok: true, data: [{ id: 2, title: '일정' }] });
      }
      return Promise.resolve({ ok: false });
    });
  });

  it('초기 홈 데이터와 현재 달을 불러온다', async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { result } = renderHook(() => useHomePageData());

    await waitFor(() => expect(result.current.calendarLoading).toBe(false));

    expect(result.current.year).toBe(year);
    expect(result.current.month).toBe(month);
    expect(result.current.posts[0]?.content).toBe('피드');
    expect(result.current.entries[0]?.title).toBe('일정');
    expect(getBff).toHaveBeenCalledWith('/api/bff/public/feed/posts?sort=LATEST&size=8');
    const range = monthRange(year, month);
    expect(getBff).toHaveBeenCalledWith(
      `/api/bff/public/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    );
  });

  it('피드 정렬과 달 이동 시 해당 조회를 다시 요청한다', async () => {
    const { result } = renderHook(() => useHomePageData());
    await waitFor(() => expect(result.current.calendarLoading).toBe(false));

    const next = shiftMonth(result.current.year, result.current.month, 1);
    act(() => result.current.onSortChange('POPULAR'));
    act(() => result.current.onShiftMonth(1));

    await waitFor(() => {
      expect(result.current.year).toBe(next.year);
      expect(result.current.month).toBe(next.month);
    });
    expect(getBff).toHaveBeenCalledWith('/api/bff/public/feed/posts?sort=POPULAR&size=8');
    const range = monthRange(next.year, next.month);
    expect(getBff).toHaveBeenCalledWith(
      `/api/bff/public/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    );
  });
});
