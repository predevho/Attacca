'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeCursorPage, shouldLoadMore } from '@/lib/feed/logic';
import type { CursorPage } from '@/lib/feed/types';

/**
 * 커서 기반 무한스크롤 목록 상태. 마운트 시 첫 페이지를 로드하고,
 * sentinel(ref)이 화면에 들어오면 다음 페이지를 로드한다(로딩 중·끝이면 가드).
 * setItems는 낙관적 좋아요 등 외부 항목 갱신에 쓴다.
 */
export function useInfiniteList<T extends { id: number }>(
  fetchPage: (cursor: number | null) => Promise<CursorPage<T> | null>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 최신 값을 옵저버 콜백에서 읽기 위한 ref(재구독 없이).
  const stateRef = useRef({ isLoading, nextCursor, loaded });
  stateRef.current = { isLoading, nextCursor, loaded };

  const load = useCallback(async (cursor: number | null, isFirst: boolean) => {
    setIsLoading(true);
    const page = await fetchPage(cursor);
    setIsLoading(false);
    if (!page) { setError('목록을 불러오지 못했습니다.'); return; }
    setError(null);
    setNextCursor(page.nextCursor);
    setItems((prev) => (isFirst ? page.items : mergeCursorPage({ items: prev, nextCursor: cursor }, page).items));
    setLoaded(true);
  }, [fetchPage]);

  // 첫 로드(마운트 1회)
  useEffect(() => {
    if (!stateRef.current.loaded) void load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sentinel 관찰
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      const s = stateRef.current;
      if (entries[0].isIntersecting && s.loaded
          && shouldLoadMore({ isLoading: s.isLoading, nextCursor: s.nextCursor })) {
        void load(s.nextCursor, false);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [load]);

  return { items, setItems, isLoading, error, hasMore: nextCursor !== null, sentinelRef };
}
