'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toCursorPage } from '@/lib/recruitment/logic';
import { PostingCard } from '@/components/recruitment/PostingCard';
import type { CursorPage } from '@/lib/feed/types';
import type { InstrumentOption, Posting, RecruitmentScope, SpringPage } from '@/lib/recruitment/types';

const TABS: { key: RecruitmentScope; label: string }[] = [
  { key: 'OPEN', label: '모집중' },
  { key: 'CLOSED', label: '마감' },
  { key: 'ALL', label: '전체' },
];

function ScopeList({ scope, instrument }: { scope: RecruitmentScope; instrument: string }) {
  const router = useRouter();
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Posting> | null> => {
    const pageNum = cursor ?? 0;
    const q = `/api/bff/recruitments?scope=${scope}&page=${pageNum}` + (instrument ? `&instrument=${instrument}` : '');
    const r = await getBff<SpringPage<Posting>>(q);
    return r.ok ? toCursorPage(r.data as SpringPage<Posting>) : null;
  }, [scope, instrument]);

  const { items, isLoading, error, hasMore, sentinelRef } = useInfiniteList<Posting>(fetchPage);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-4">
        {items.map((p) => (
          <PostingCard key={p.id} posting={p} onOpen={() => router.push(`/recruitments/${p.id}`)} />
        ))}
      </div>
      {isLoading && <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {!hasMore && items.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">등록된 공고가 없습니다.</p>
      )}
    </>
  );
}

export default function RecruitmentsPage() {
  const router = useRouter();
  const [scope, setScope] = useState<RecruitmentScope>('OPEN');
  const [instrument, setInstrument] = useState('');
  const [options, setOptions] = useState<InstrumentOption[]>([]);
  const [canRegister, setCanRegister] = useState(false);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (r.ok) setCanRegister(true); // 로그인 회원 누구나(게이팅 없음)
      else router.push('/login');
    });
    getBff('/api/bff/profile-options').then((r) => {
      if (r.ok) setOptions((r.data as { instruments: InstrumentOption[] }).instruments);
    });
  }, [router]);

  return (
    <main className="mx-auto mt-8 max-w-xl px-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">구인</h1>
        {canRegister && (
          <button type="button" onClick={() => router.push('/recruitments/new')}
            className="rounded bg-black px-3 py-1.5 text-sm text-white">공고 등록</button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setScope(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${scope === t.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t.label}
          </button>
        ))}
        <select aria-label="악기 필터" value={instrument} onChange={(e) => setInstrument(e.target.value)}
          className="ml-auto rounded border px-2 py-1 text-sm">
          <option value="">전체 파트</option>
          {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
      </div>

      <ScopeList key={`${scope}:${instrument}`} scope={scope} instrument={instrument} />

      <div className="mt-6 text-center">
        <button type="button" onClick={() => router.push('/recruitments/applications/me')}
          className="text-sm text-gray-500 underline">내 지원 현황</button>
      </div>
    </main>
  );
}
