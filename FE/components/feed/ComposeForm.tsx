'use client';

import { useId, useState } from 'react';

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
  const countId = useId();

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
      {/*
        placeholder는 접근명이 아니다 — 입력을 시작하면 사라지고, 보조기술이 이름으로
        읽어 준다는 보장도 없다. 라벨을 따로 두면 화면이 달라지므로 aria-label로 같은 문구를 준다.
        글자수는 aria-describedby로 묶어 남은 길이를 입력 중에도 알 수 있게 한다.
      */}
      <textarea
        value={content}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-describedby={countId}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-20 w-full rounded border border-line px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <span id={countId} className="text-xs text-ink-faint">{content.length}/{maxLength}</span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || content.trim().length === 0}
          className="rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-40"
        >
          {submitting ? '전송 중...' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
