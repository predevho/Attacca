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
    <li className="flex flex-col gap-2 rounded border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        {/* 닉네임 없이 번호만 보이면 어드민이 누구를 승인하는지 모른 채 눌러야 한다. */}
        <span className="text-sm font-medium">
          {application.applicant
            ? <>{application.applicant.nickname}
                <span className="ml-1 text-xs font-normal text-ink-muted">#{application.memberId}</span></>
            : <>회원 #{application.memberId}</>}
        </span>
        <span className="text-xs text-ink-muted">{statusLabel(application.status)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink-muted">{application.statement}</p>
      {application.evidenceUrls.length > 0 && (
        <ul className="text-sm">
          {application.evidenceUrls.map((u, i) => (
            <li key={i}>
              {isHttpUrl(u)
                ? <a href={u} target="_blank" rel="noreferrer" className="text-brand-strong underline">{u}</a>
                : <span>{u}</span>}
            </li>
          ))}
        </ul>
      )}
      {application.decisionReason && (
        <p className="text-sm text-ink-muted">처리 사유: <span>{application.decisionReason}</span></p>
      )}

      {application.status === 'PENDING' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => onApprove(application.id)}
            className="rounded bg-brand px-3 py-1 text-xs text-on-brand">승인</button>
          <button type="button" onClick={() => open('reject')}
            className="rounded border border-line px-3 py-1 text-xs">거절</button>
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
            className="h-20 rounded border border-line px-3 py-2 text-sm" />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={submitReason}
              className="rounded bg-brand px-3 py-1 text-xs text-on-brand">제출</button>
            <button type="button" onClick={cancel}
              className="rounded border border-line px-3 py-1 text-xs">취소</button>
          </div>
        </div>
      )}
    </li>
  );
}
