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
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
  }, [fetchPage]);

  // 첫 로드(마운트 1회)
  useEffect(() => {
    if (!stateRef.current.loaded) void load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 옵저버 콜백이 부를 최신 load. 콜백 ref를 항상 같은 함수로 유지하기 위해 한 겹 둔다
  // (ref가 매 렌더 바뀌면 React가 붙였다 뗐다 하며 옵저버를 계속 다시 만든다).
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // sentinel 관찰 — **ref 콜백**이라야 한다.
  //
  // ⚠️ 이걸 `useEffect(..., [load])`로 두면 안 된다. 실제 화면들은 sentinel을
  // `{hasMore && <div ref={sentinelRef} />}`로 그리는데, `hasMore`는 첫 페이지가
  // 오기 전까지 거짓이다. 마운트 시점엔 ref가 비어 있어 이펙트가 그냥 빠져나가고,
  // `load`는 신원이 안 바뀌므로 이펙트가 다시 돌지 않는다 →
  // **옵저버가 영영 붙지 않아 무한스크롤이 첫 페이지에서 멈춘다.**
  // ref 콜백은 요소가 실제로 붙는 순간 호출되므로 화면이 언제 sentinel을 그리든 상관없다.
  // (2026-09-09 발견. 그전 테스트는 sentinel을 무조건 그려서 이 차이를 못 봤다.)
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      const s = stateRef.current;
      if (entries[0].isIntersecting && s.loaded
          && shouldLoadMore({ isLoading: s.isLoading, nextCursor: s.nextCursor })) {
        void loadRef.current(s.nextCursor, false);
      }
    });
    obs.observe(el);
    observerRef.current = obs;
  }, []);

  return { items, setItems, isLoading, error, hasMore: nextCursor !== null, sentinelRef };
}
