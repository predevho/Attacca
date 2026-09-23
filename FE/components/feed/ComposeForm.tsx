'use client';

import { useId, useState } from 'react';
import { AttachmentPicker } from '@/components/files/AttachmentPicker';
import { useTemporaryAttachments } from '@/lib/attachments/useTemporaryAttachments';

export function ComposeForm({
  placeholder, maxLength, buttonLabel, allowAttachments = false, onSubmit,
}: {
  placeholder: string;
  maxLength: number;
  buttonLabel: string;
  allowAttachments?: boolean;
  onSubmit: (content: string, attachmentIds?: number[]) => Promise<boolean>;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const countId = useId();
  const attachments = useTemporaryAttachments();

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const upload = allowAttachments ? await attachments.upload() : { ok: true as const, attachmentIds: [] };
    if (!upload.ok) {
      setSubmitting(false);
      return;
    }
    const okDone = allowAttachments
      ? await onSubmit(trimmed, upload.attachmentIds)
      : await onSubmit(trimmed);
    setSubmitting(false);
    if (okDone) {
      setContent('');
      attachments.clear();
    } else {
      setSubmitError(`${buttonLabel}하지 못했습니다. 다시 시도해 주세요.`);
    }
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
      {allowAttachments && (
        <AttachmentPicker
          items={attachments.items}
          error={attachments.error}
          disabled={submitting || attachments.uploading}
          onAdd={attachments.addFiles}
          onRemove={attachments.remove}
          onRetry={attachments.retry}
        />
      )}
      {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}
      <div className="flex items-center justify-between">
        <span id={countId} className="text-xs text-ink-faint">{content.length}/{maxLength}</span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || attachments.uploading || content.trim().length === 0}
          className="rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-40"
        >
          {submitting ? '전송 중...' : buttonLabel}
        </button>
      </div>
    </div>
  );
}
