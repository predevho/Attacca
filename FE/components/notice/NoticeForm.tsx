'use client';

import { useState } from 'react';
import { validateNotice, hasError, type NoticeErrors } from '@/lib/notice/logic';
import type { NoticeFormValues, NoticeType } from '@/lib/notice/types';

const TYPES: { key: NoticeType; label: string; hint: string }[] = [
  { key: 'NOTICE', label: '공지', hint: '운영 안내' },
  { key: 'NEWS', label: '뉴스', hint: '소식' },
  { key: 'EVENT', label: '일정', hint: '달력에 표시됩니다' },
];

/**
 * 공지 등록·수정 폼. 등록과 수정이 같은 폼을 쓴다 — 항목이 같은데 화면이 둘이면
 * 한쪽만 고치는 일이 생긴다.
 */
export function NoticeForm({
  initial, submitLabel, pending, onSubmit, onCancel,
}: {
  initial: NoticeFormValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: NoticeFormValues) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<NoticeFormValues>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof NoticeFormValues, boolean>>>({});
  const errors: NoticeErrors = validateNotice(form);

  function msgFor(key: keyof NoticeFormValues) {
    return touched[key] ? errors[key] : undefined;
  }
  function set<K extends keyof NoticeFormValues>(key: K, value: NoticeFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function blur(key: keyof NoticeFormValues) {
    return () => setTouched((t) => ({ ...t, [key]: true }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError(errors)) {
      setTouched({ title: true, content: true, place: true, scheduledAt: true });
      return;
    }
    onSubmit(form);
  }

  const titleMsg = msgFor('title');
  const contentMsg = msgFor('content');
  const placeMsg = msgFor('place');
  const scheduledMsg = msgFor('scheduledAt');

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-ink-muted">종류</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => set('type', t.key)}
              className={form.type === t.key
                ? 'rounded-full bg-brand px-3 py-1 text-sm text-on-brand'
                : 'rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-muted'}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">{TYPES.find((t) => t.key === form.type)?.hint}</p>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">제목
        <input value={form.title} onChange={(e) => set('title', e.target.value)}
          onBlur={blur('title')} aria-invalid={titleMsg ? true : undefined}
          className={titleMsg
            ? 'rounded border border-danger px-3 py-2'
            : 'rounded border border-line px-3 py-2'} />
        {titleMsg && <span role="alert" className="text-xs text-danger">{titleMsg}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        본문 ({form.content.length}/5000)
        <textarea value={form.content} onChange={(e) => set('content', e.target.value)}
          onBlur={blur('content')} aria-invalid={contentMsg ? true : undefined}
          className={contentMsg
            ? 'h-48 rounded border border-danger px-3 py-2'
            : 'h-48 rounded border border-line px-3 py-2'} />
        {contentMsg && <span role="alert" className="text-xs text-danger">{contentMsg}</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">일시
        <input type="datetime-local" value={form.scheduledAt}
          onChange={(e) => set('scheduledAt', e.target.value)} onBlur={blur('scheduledAt')}
          aria-invalid={scheduledMsg ? true : undefined}
          className={scheduledMsg
            ? 'rounded border border-danger px-3 py-2'
            : 'rounded border border-line px-3 py-2'} />
        {scheduledMsg
          ? <span role="alert" className="text-xs text-danger">{scheduledMsg}</span>
          : <span className="text-xs text-ink-faint">비우면 달력에 표시되지 않습니다.</span>}
      </label>

      <label className="flex flex-col gap-1 text-sm">장소
        <input value={form.place} onChange={(e) => set('place', e.target.value)}
          onBlur={blur('place')} aria-invalid={placeMsg ? true : undefined}
          className={placeMsg
            ? 'rounded border border-danger px-3 py-2'
            : 'rounded border border-line px-3 py-2'} />
        {placeMsg && <span role="alert" className="text-xs text-danger">{placeMsg}</span>}
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={form.pinned}
          onChange={(e) => set('pinned', e.target.checked)} />
        <span>
          상단 고정
          <span className="block text-xs text-ink-faint">홈 캐러셀에 실립니다.</span>
        </span>
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="rounded bg-brand px-4 py-2 text-sm text-on-brand disabled:opacity-50">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded border border-line px-4 py-2 text-sm">취소</button>
        )}
      </div>
    </form>
  );
}
