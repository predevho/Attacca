'use client';

import { useState } from 'react';
import { validateGrant } from '@/lib/verification/logic';
import type { GrantFormValues } from '@/lib/verification/types';

export function GrantForm({
  submitting, onGrant,
}: {
  submitting: boolean;
  onGrant: (v: GrantFormValues) => void;
}) {
  const [memberId, setMemberId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const v: GrantFormValues = { memberId, reason };
    const err = validateGrant(v);
    if (err) { setError(err); return; }
    setError(null);
    onGrant(v);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-medium text-ink-muted">직접지정</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input aria-label="회원 id" type="number" min={1} value={memberId}
          onChange={(e) => setMemberId(e.target.value)} placeholder="회원 id"
          className="w-full rounded border border-line px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-32" />
        <input aria-label="사유(선택)" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="사유(선택)" className="min-w-0 flex-1 rounded border border-line px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
        <button type="button" onClick={submit} disabled={submitting}
          className="min-h-10 rounded bg-brand px-4 py-2 text-sm text-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-40">직접지정</button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
