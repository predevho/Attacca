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

/**
 * 실제 화면(피드·공연·구인·채팅·인증심사)이 sentinel을 그리는 방식.
 * `hasMore`가 참일 때만 그리므로 **첫 렌더에는 sentinel이 없다.**
 * 훅이 마운트 때 한 번만 옵저버를 붙이면 여기서 영원히 붙지 못한다.
 */
function ConditionalHarness({ fetchPage }: { fetchPage: (c: number | null) => Promise<CursorPage<Item> | null> }) {
  const { items, sentinelRef, hasMore } = useInfiniteList<Item>(fetchPage);
  return (
    <div>
      <ul>{items.map((i) => <li key={i.id}>item-{i.id}</li>)}</ul>
      <span>hasMore:{String(hasMore)}</span>
      {hasMore && <div data-testid="sentinel" ref={sentinelRef} />}
    </div>
  );
}

const io = () => (globalThis as unknown as { __io: { trigger: () => void; observing: number; reset: () => void } }).__io;

beforeEach(() => { vi.clearAllMocks(); io().reset(); });

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

    // 첫 페이지가 화면에 뜨자마자 교차시킨다 — 이펙트를 따로 비워 주지 않는다.
    // 훅이 최신 상태를 이펙트로 미뤄 두면 여기서 낡은 값을 읽어 두 번째 로드를
    // 건너뛴다. 이 시점에 이미 최신이어야 한다.
    await act(async () => { io().trigger(); });

    expect(await screen.findByText('item-2')).toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(3);
    await waitFor(() => expect(screen.getByText('hasMore:false')).toBeInTheDocument());
  });

  // sentinel을 hasMore일 때만 그리는 실제 화면들에서 무한스크롤이 아예 붙지 않던 결함.
  it('첫 로드 뒤에 나타난 sentinel에도 옵저버를 붙인다', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 3 }], nextCursor: 3 })
      .mockResolvedValueOnce({ items: [{ id: 2 }], nextCursor: null });
    render(<ConditionalHarness fetchPage={fetchPage} />);
    await screen.findByText('item-3');

    // 첫 페이지가 오고 나서야 sentinel이 DOM에 생긴다.
    expect(screen.getByTestId('sentinel')).toBeInTheDocument();
    expect(io().observing).toBe(1);

    await act(async () => { io().trigger(); });
    expect(await screen.findByText('item-2')).toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(3);
  });

  it('sentinel이 사라지면 관찰을 끊는다', async () => {
    // 끝에 도달하면 화면이 sentinel을 걷어낸다. 옵저버가 남으면 누수다.
    const fetchPage = vi.fn(async () => ({ items: [{ id: 3 }], nextCursor: null }));
    render(<ConditionalHarness fetchPage={fetchPage} />);
    await screen.findByText('item-3');
    expect(screen.queryByTestId('sentinel')).not.toBeInTheDocument();
    expect(io().observing).toBe(0);
  });
});
