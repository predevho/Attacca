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

    // 첫 페이지가 화면에 뜨자마자 교차시킨다 — 이펙트를 따로 비워 주지 않는다.
    // 훅이 최신 상태를 이펙트로 미뤄 두면 여기서 낡은 값을 읽어 두 번째 로드를
    // 건너뛴다. 이 시점에 이미 최신이어야 한다.
    await act(async () => { (globalThis as unknown as { __io: { trigger: () => void } }).__io.trigger(); });

    // 타임아웃을 넉넉히 준다. 이 테스트는 2026-09-08 CI에서 한 번 깨졌는데
    // 파일 전체가 1124ms였고 기본 타임아웃이 1000ms였다. 러너(2 vCPU)에서
    // 71개 파일을 병렬로 돌리다 워커가 굶은 것과 구분이 되지 않았다.
    // 로컬에서는 재현되지 않았다.
    expect(await screen.findByText('item-2', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(3);
    await waitFor(() => expect(screen.getByText('hasMore:false')).toBeInTheDocument(), { timeout: 5000 });
  });
});
