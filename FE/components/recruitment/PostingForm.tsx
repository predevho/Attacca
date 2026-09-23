'use client';

import { useState } from 'react';
import { AttachmentPicker } from '@/components/files/AttachmentPicker';
import { validatePosting } from '@/lib/recruitment/logic';
import { InstrumentPicker } from '@/components/recruitment/InstrumentPicker';
import { useTemporaryAttachments } from '@/lib/attachments/useTemporaryAttachments';
import type { InstrumentOption, PostingFormValues } from '@/lib/recruitment/types';

const EMPTY: PostingFormValues = {
  title: '', description: '', instruments: [], recruitCount: '', location: '', fee: '', deadline: '',
};

export function PostingForm({
  options, initial, submitting, submitLabel, onSubmit,
}: {
  options: InstrumentOption[];
  initial?: Partial<PostingFormValues>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (v: PostingFormValues, attachmentIds: number[]) => void | Promise<void>;
}) {
  const [v, setV] = useState<PostingFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const attachments = useTemporaryAttachments();

  function field<K extends keyof PostingFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setV((cur) => ({ ...cur, [key]: e.target.value }));
  }

  function toggleInstrument(code: string) {
    setV((cur) => ({
      ...cur,
      instruments: cur.instruments.includes(code)
        ? cur.instruments.filter((c) => c !== code)
        : [...cur.instruments, code],
    }));
  }

  async function submit() {
    const err = validatePosting(v);
    if (err) { setError(err); return; }
    setError(null);
    const upload = await attachments.upload();
    if (!upload.ok) return;
    await onSubmit(v, upload.attachmentIds);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">제목</span>
        <input aria-label="제목" value={v.title} maxLength={100} onChange={field('title')}
          className="rounded border border-line px-3 py-2" />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">모집 파트</span>
        <InstrumentPicker options={options} selected={v.instruments} onToggle={toggleInstrument} />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">모집 인원</span>
        <input aria-label="모집 인원" type="number" min={1} value={v.recruitCount} onChange={field('recruitCount')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">활동 지역/장소</span>
        <input aria-label="활동 지역" value={v.location} maxLength={200} onChange={field('location')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">보수 안내</span>
        <input aria-label="보수 안내" value={v.fee} maxLength={200} onChange={field('fee')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">마감일 (비우면 상시모집)</span>
        <input aria-label="마감일" type="datetime-local" value={v.deadline} onChange={field('deadline')}
          className="rounded border border-line px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">설명</span>
        <textarea aria-label="설명" value={v.description} maxLength={2000} onChange={field('description')}
          className="h-32 rounded border border-line px-3 py-2" />
      </label>

      <AttachmentPicker
        items={attachments.items}
        error={attachments.error}
        disabled={submitting || attachments.uploading}
        onAdd={attachments.addFiles}
        onRemove={attachments.remove}
        onRetry={attachments.retry}
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="button" onClick={submit} disabled={submitting || attachments.uploading}
        className="rounded bg-brand px-4 py-2 text-on-brand disabled:opacity-40">
        {submitting ? '처리 중...' : submitLabel}
      </button>
    </div>
  );
}
