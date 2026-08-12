'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/api';
import { useInfiniteList } from '@/lib/feed/useInfiniteList';
import { toCursorPage, toGrantRequest } from '@/lib/verification/logic';
import { ApplicationReviewItem } from '@/components/verification/ApplicationReviewItem';
import { GrantForm } from '@/components/verification/GrantForm';
import type { CursorPage, Me } from '@/lib/feed/types';
import type { Application, GrantFormValues, SpringPage, VerificationStatus } from '@/lib/verification/types';

const TABS: { key: VerificationStatus; label: string }[] = [
  { key: 'PENDING', label: '심사 중' },
  { key: 'APPROVED', label: '승인됨' },
  { key: 'REJECTED', label: '거절됨' },
  { key: 'REVOKED', label: '철회됨' },
];

function ReviewList({
  status, refreshKey, onApprove, onReject, onRevoke,
}: {
  status: VerificationStatus;
  refreshKey: number;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  onRevoke: (id: number, reason: string) => void;
}) {
  const fetchPage = useCallback(async (cursor: number | null): Promise<CursorPage<Application> | null> => {
    const pageNum = cursor ?? 0;
    const r = await getBff<SpringPage<Application>>(`/api/bff/admin/verified-performers/applications?status=${status}&page=${pageNum}`);
    return r.ok ? toCursorPage(r.data as SpringPage<Application>) : null;
  }, [status, refreshKey]); // refreshKey 변경 시 새 fetchPage → 재조회

  const { items, isLoading, error, hasMore, sentinelRef } = useInfiniteList<Application>(fetchPage);

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col gap-3">
        {items.map((a) => (
          <ApplicationReviewItem key={a.id} application={a} onApprove={onApprove} onReject={onReject} onRevoke={onRevoke} />
        ))}
      </ul>
      {isLoading && <p className="py-4 text-center text-sm text-gray-400">불러오는 중...</p>}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {!hasMore && items.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">해당 상태의 신청이 없습니다.</p>
      )}
    </>
  );
}

export default function AdminVerifiedPerformersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<VerificationStatus>('PENDING');
  const [refreshKey, setRefreshKey] = useState(0);
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getBff('/api/bff/me/identity').then((r) => {
      if (!r.ok) { router.push('/login'); return; }
      const me = r.data as Me;
      if (me.role !== 'ADMIN') { router.push('/dashboard'); return; }
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(path: string, body?: unknown) {
    const r = body === undefined ? await postBff(path) : await postBff(path, body);
    if (r.ok) { setMessage(null); setRefreshKey((k) => k + 1); }
    else setMessage(r.message ?? '처리에 실패했습니다.');
  }

  const onApprove = (id: number) => act(`/api/bff/admin/verified-performers/applications/${id}/approve`);
  const onReject = (id: number, reason: string) => act(`/api/bff/admin/verified-performers/applications/${id}/reject`, { reason });
  const onRevoke = (id: number, reason: string) => act(`/api/bff/admin/verified-performers/applications/${id}/revoke`, { reason });

  async function onGrant(v: GrantFormValues) {
    setGrantSubmitting(true);
    const r = await postBff('/api/bff/admin/verified-performers/grant', toGrantRequest(v));
    setGrantSubmitting(false);
    if (r.ok) { setMessage('직접지정 완료'); setRefreshKey((k) => k + 1); }
    else setMessage(r.message ?? '직접지정에 실패했습니다.');
  }

  if (!ready) return <main className="mx-auto mt-16 max-w-3xl px-4 text-sm text-gray-400">불러오는 중...</main>;

  return (
    <main className="mx-auto mt-8 max-w-3xl px-4">
      <h1 className="mb-4 text-2xl font-bold">인증 연주자 심사</h1>

      <div className="mb-4"><GrantForm submitting={grantSubmitting} onGrant={onGrant} /></div>

      {message && <p className="mb-3 text-sm text-gray-700">{message}</p>}

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setStatus(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${status === t.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ReviewList key={`${status}:${refreshKey}`} status={status} refreshKey={refreshKey}
        onApprove={onApprove} onReject={onReject} onRevoke={onRevoke} />
    </main>
  );
}
