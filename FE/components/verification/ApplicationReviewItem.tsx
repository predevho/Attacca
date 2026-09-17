'use client';

import { useState } from 'react';
import { isHttpUrl, statusLabel, validateReason } from '@/lib/verification/logic';
import type { Application } from '@/lib/verification/types';

export function ApplicationReviewItem({
  application, onApprove, onReject, onRevoke,
}: {
  application: Application;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
  onRevoke: (id: number, reason: string) => void;
}) {
  const [mode, setMode] = useState<'reject' | 'revoke' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function open(next: 'reject' | 'revoke') {
    setMode(next);
    setReason('');
    setError(null);
  }
  function cancel() {
    setMode(null);
    setReason('');
    setError(null);
  }

  function submitReason() {
    const err = validateReason(reason);
    if (err) { setError(err); return; }
    setError(null);
    if (mode === 'reject') onReject(application.id, reason);
    else if (mode === 'revoke') onRevoke(application.id, reason);
  }

  return (
    <li className="flex flex-col gap-3 rounded border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {/* 닉네임 없이 번호만 보이면 어드민이 누구를 승인하는지 모른 채 눌러야 한다. */}
        <span className="text-sm font-medium">
          {application.applicant
            ? <>{application.applicant.nickname}
                <span className="ml-1 text-xs font-normal text-ink-muted">#{application.memberId}</span></>
            : <>회원 #{application.memberId}</>}
        </span>
        <span className="text-xs text-ink-muted">{statusLabel(application.status)}</span>
      </div>
      <p className="break-words whitespace-pre-wrap text-sm text-ink-muted">{application.statement}</p>
      {application.evidenceUrls.length > 0 && (
        <ul className="text-sm">
          {application.evidenceUrls.map((u, i) => (
            <li key={i}>
              {isHttpUrl(u)
                ? <a href={u} target="_blank" rel="noreferrer" className="break-words text-brand-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{u}</a>
                : <span>{u}</span>}
            </li>
          ))}
        </ul>
      )}
      {application.decisionReason && (
        <p className="text-sm text-ink-muted">처리 사유: <span>{application.decisionReason}</span></p>
      )}

      {application.status === 'PENDING' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onApprove(application.id)}
            className="min-h-10 rounded bg-brand px-3 py-2 text-xs text-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">승인</button>
          <button type="button" onClick={() => open('reject')}
            className="min-h-10 rounded border border-line px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">거절</button>
        </div>
      )}
      {application.status === 'APPROVED' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => open('revoke')}
            className="rounded border border-line px-3 py-1 text-xs">철회</button>
        </div>
      )}

      {mode && (
        <div className="flex flex-col gap-2 rounded border border-line p-2">
          <textarea aria-label="처리 사유" value={reason} maxLength={500}
            onChange={(e) => setReason(e.target.value)} placeholder="처리 사유를 입력하세요"
            className="h-20 w-full rounded border border-line px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={submitReason}
              className="min-h-10 rounded bg-brand px-3 py-2 text-xs text-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">제출</button>
            <button type="button" onClick={cancel}
              className="min-h-10 rounded border border-line px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">취소</button>
          </div>
        </div>
      )}
    </li>
  );
}
