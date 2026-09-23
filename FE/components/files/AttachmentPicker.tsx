'use client';

import { useId } from 'react';
import {
  MAX_ATTACHMENT_COUNT,
  type PendingAttachment,
} from '@/lib/attachments/useTemporaryAttachments';

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export function AttachmentPicker({
  items,
  error,
  disabled,
  onAdd,
  onRemove,
  onRetry,
}: {
  items: PendingAttachment[];
  error: string | null;
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (clientId: string) => void;
  onRetry: (clientId: string) => Promise<unknown>;
}) {
  const descriptionId = useId();
  const errorId = useId();

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="attachment-files" className="font-medium text-ink-muted">첨부 파일</label>
        <span className="text-xs text-ink-faint">{items.length}/{MAX_ATTACHMENT_COUNT}</span>
      </div>
      <input
        id="attachment-files"
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        disabled={disabled || items.length >= MAX_ATTACHMENT_COUNT}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
        className="block w-full rounded border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-3 file:py-1 file:text-sm file:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p id={descriptionId} className="text-xs text-ink-faint">JPG, PNG, WebP, PDF · 파일당 10MB · 최대 5개</p>
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}
      {items.length > 0 && (
        <ul aria-label="선택한 첨부 파일" className="divide-y divide-line rounded border border-line">
          {items.map((item) => (
            <li key={item.clientId} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.file.name}</p>
                <p className={item.status === 'failed' ? 'text-xs text-danger' : 'text-xs text-ink-faint'}>
                  {item.status === 'uploading'
                    ? '업로드 중...'
                    : item.status === 'failed'
                      ? item.error ?? '파일 업로드에 실패했습니다.'
                      : formatSize(item.file.size)}
                </p>
              </div>
              {item.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => void onRetry(item.clientId)}
                  disabled={disabled}
                  className="shrink-0 rounded border border-danger px-2 py-1 text-xs font-medium text-danger disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다시 시도
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.clientId)}
                disabled={disabled}
                aria-label={`${item.file.name} 제거`}
                className="shrink-0 rounded border border-line px-2 py-1 text-xs text-ink-muted disabled:opacity-50"
              >
                제거
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
