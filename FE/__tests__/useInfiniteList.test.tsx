import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import type { CursorPage } from '@/lib/feed/types';

type Item = { id: number };

function Harness({ fetchPage }: { fetchPage: (c: number | null) => Promise<CursorPage<Item> | null> }) {
  const { items, sentinelRef, hasMore } = useInfiniteList<Item>(fetchPage);
  return (
    <div>
      <ul>{items.map((i) => <li key={i.id}>item-{i.id}</li>)}</ul>
      <span>hasMore:{String(hasMore)}</span>
      <div data-testid="sentinel" ref={sentinelRef} />
    </div>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('useInfiniteList', () => {
  it('마운트 시 첫 페이지를 로드한다', async () => {
    const fetchPage = vi.fn(async () => ({ items: [{ id: 3 }, { id: 2 }], nextCursor: 2 }));
    render(<Harness fetchPage={fetchPage} />);
    expect(await screen.findByText('item-3')).toBeInTheDocument();
    expect(fetchPage).toHaveBeenCalledWith(null);
    expect(screen.getByText('hasMore:true')).toBeInTheDocument();
  });

  it('sentinel 교차 시 다음 페이지를 커서로 로드하고 병합한다', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 3 }], nextCursor: 3 })
      .mockResolvedValueOnce({ items: [{ id: 2 }], nextCursor: null });
    render(<Harness fetchPage={fetchPage} />);
    await screen.findByText('item-3');

    await act(async () => { (globalThis as unknown as { __io: { trigger: () => void } }).__io.trigger(); });

    expect(await screen.findByText('item-2')).toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(3);
    await waitFor(() => expect(screen.getByText('hasMore:false')).toBeInTheDocument());
  });
});
