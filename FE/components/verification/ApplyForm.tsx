'use client';

import { useState } from 'react';
import { validateApply } from '@/lib/verification/logic';
import { EvidenceUrlsInput } from '@/components/verification/EvidenceUrlsInput';
import type { ApplyFormValues } from '@/lib/verification/types';

export function ApplyForm({
  submitting, submitLabel, onSubmit,
}: {
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: ApplyFormValues) => void;
}) {
  const [statement, setStatement] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const v: ApplyFormValues = { statement, evidenceUrls };
    const err = validateApply(v);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(v);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">지원 사유</span>
        <textarea aria-label="지원 사유" value={statement} maxLength={1000}
          onChange={(e) => setStatement(e.target.value)} className="h-32 rounded border border-line px-3 py-2" />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">증빙 링크 (최대 10개)</span>
        <EvidenceUrlsInput urls={evidenceUrls} onChange={setEvidenceUrls} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={submit} disabled={submitting}
        className="self-start rounded bg-brand px-4 py-2 text-on-brand disabled:opacity-40">
        {submitting ? '처리 중...' : submitLabel}
      </button>
    </div>
  );
}
