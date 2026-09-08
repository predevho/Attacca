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

  // 옵저버 콜백이 읽을 최신 값(재구독 없이).
  //
  // ⚠️ 이 갱신을 `useEffect`에 두면 안 된다. IntersectionObserver 콜백은 브라우저
  // 이벤트라 커밋과 패시브 이펙트 flush 사이에 끼어들 수 있고, 그때 콜백은
  // `loaded:false / nextCursor:null`인 낡은 값을 읽어 다음 페이지 로드를 건너뛴다.
  // 한 번 건너뛰면 다시 트리거될 일이 없어 **목록이 그대로 멈춘다.**
  // 2026-09-08 CI에서 5초를 기다려도 두 번째 로드가 오지 않는 것으로 확인했다.
  //
  // 그래서 렌더나 이펙트 타이밍에 기대지 않고, 상태를 바꾸는 바로 그 자리에서
  // 함께 갱신한다. (렌더 중 ref 쓰기는 eslint `react-hooks/refs`가 막는다.)
  const stateRef = useRef({ isLoading: false, nextCursor: null as number | null, loaded: false });

  const load = useCallback(async (cursor: number | null, isFirst: boolean) => {
    stateRef.current.isLoading = true;
    setIsLoading(true);
    const page = await fetchPage(cursor);
    stateRef.current.isLoading = false;
    setIsLoading(false);
    if (!page) { setError('목록을 불러오지 못했습니다.'); return; }
    setError(null);
    stateRef.current.nextCursor = page.nextCursor;
    setNextCursor(page.nextCursor);
    setItems((prev) => (isFirst ? page.items : mergeCursorPage({ items: prev, nextCursor: cursor }, page).items));
    stateRef.current.loaded = true;
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
