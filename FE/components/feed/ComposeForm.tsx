'use client';

import { useState } from 'react';

export function ComposeForm({
  placeholder, maxLength, buttonLabel, onSubmit,
}: {
  placeholder: string;
  maxLength: number;
  buttonLabel: string;
  onSubmit: (content: string) => Promise<boolean>;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const okDone = await onSubmit(trimmed);
    setSubmitting(false);
    if (okDone) setContent('');
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={content}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-20 w-full rounded border px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{content.length}/{maxLength}</span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || content.trim().length === 0}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {submitting ? '전송 중...' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
