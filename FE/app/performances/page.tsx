'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toCursorPage } from '@/lib/performance/logic';
import { PerformanceCard } from '@/components/performance/PerformanceCard';
import type { CursorPage, Me } from '@/lib/feed/types';
import type { Performance, PerformanceScope, SpringPage } from '@/lib/performance/types';

const TABS: { key: PerformanceScope; label: string }[] = [
  { key: 'UPCOMING', label: '다가오는' },
  { key: 'PAST', label: '지난' },
  { key: 'ALL', label: '전체' },
];

function ScopeList({ scope }: { scope: PerformanceScope }) {
  const router = useRouter();
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Performance> | null> => {
    const pageNum = cursor ?? 0;
    // 공개 경로로 읽는다 — 로그인하지 않아도 목록이 보여야 한다.
    // 쓰기(등록·수정·삭제)만 인증 경로를 쓴다.
    const r = await getBff<SpringPage<Performance>>(
      `/api/bff/public/performances?scope=${scope}&page=${pageNum}`);
    return r.ok ? toCursorPage(r.data as SpringPage<Performance>) : null;
  }, [scope]);

  const { items, isLoading, error, loaded, hasMore, sentinelRef } = useInfiniteList<Performance>(fetchPage);

  return (
    <>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-4">
        {items.map((p) => (
          <PerformanceCard key={p.id} performance={p} onOpen={() => router.push(`/performances/${p.id}`)} />
        ))}
      </div>
      {isLoading && <p className="py-4 text-center text-sm text-ink-faint">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {loaded && items.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-faint">등록된 공연이 없습니다.</p>
      )}
    </>
  );
}

export default function PerformancesPage() {
  const router = useRouter();
  const [scope, setScope] = useState<PerformanceScope>('UPCOMING');
  const [canRegister, setCanRegister] = useState(false);

  const moveScope = (index: number) => {
    const next = (index + TABS.length) % TABS.length;
    setScope(TABS[next].key);
    document.getElementById(`performance-tab-${TABS[next].key}`)?.focus();
  };

  // 신원 조회는 '등록' 버튼을 보일지만 정한다. 실패해도 로그인으로 보내지 않는다 —
  // 이 화면은 비로그인도 볼 수 있어야 하고, 예전에는 여기서 튕겨 나가
  // 공개 API가 있는데도 아무도 공연을 볼 수 없었다(2026-09-09).
  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (!r.ok) return;
      const me = r.data as Me;
      setCanRegister(me.verified || me.role === 'ADMIN');
    });
  }, []);

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">공연</h1>
        {canRegister && (
          <button type="button" onClick={() => router.push('/performances/new')}
            className="rounded bg-brand px-3 py-1.5 text-sm text-on-brand">공연 등록</button>
        )}
      </div>

      <div role="tablist" aria-label="공연 범위" className="mb-4 flex gap-2 border-b border-line">
        {TABS.map((t, index) => (
          <button key={t.key} type="button" onClick={() => setScope(t.key)}
            id={`performance-tab-${t.key}`}
            role="tab"
            aria-selected={scope === t.key}
            aria-controls="performance-tabpanel"
            tabIndex={scope === t.key ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                moveScope(index + 1);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveScope(index - 1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                moveScope(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                moveScope(TABS.length - 1);
              }
            }}
            className={`border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${scope === t.key ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-muted hover:border-line hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div id="performance-tabpanel" role="tabpanel" aria-labelledby={`performance-tab-${scope}`}>
        <ScopeList key={scope} scope={scope} />
      </div>
    </main>
  );
}
