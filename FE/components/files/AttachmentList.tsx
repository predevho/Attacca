'use client';

import { useEffect, useState } from 'react';
import type { AttachmentFile } from '@/lib/feed/types';

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageAttachment(attachment: AttachmentFile) {
  return attachment.contentType.startsWith('image/');
}

/** 게시와 연결된 파일을 열람하는 읽기 전용 목록이다. */
export function AttachmentList({ attachments }: { attachments?: AttachmentFile[] }) {
  const [preview, setPreview] = useState<AttachmentFile | null>(null);

  useEffect(() => {
    if (!preview) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [preview]);

  if (!attachments || attachments.length === 0) return null;

  return (
    <section aria-label="첨부 파일" className="mt-4 border-t border-line pt-3">
      <h2 className="mb-2 text-sm font-medium text-ink-muted">첨부 파일</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {attachments.filter(isImageAttachment).map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              aria-label={`${attachment.originalName} 미리보기`}
              onClick={() => setPreview(attachment)}
              className="group overflow-hidden rounded border border-line bg-surface-muted text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <img
                src={attachment.url}
                alt={attachment.originalName}
                className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
        {attachments.some((attachment) => !isImageAttachment(attachment)) && (
          <ul className="divide-y divide-line rounded border border-line">
            {attachments.filter((attachment) => !isImageAttachment(attachment)).map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="min-w-0 truncate">{attachment.originalName}</span>
                  <span className="shrink-0 text-xs text-ink-faint">{formatSize(attachment.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="attachment-preview-title"
            className="relative max-h-[90vh] max-w-[min(90vw,960px)] rounded border border-line bg-surface p-3 shadow-xl"
          >
            <h2 id="attachment-preview-title" className="sr-only">
              {preview.originalName} 미리보기
            </h2>
            <button
              type="button"
              aria-label="미리보기 닫기"
              onClick={() => setPreview(null)}
              className="absolute right-2 top-2 z-10 rounded border border-line bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              닫기
            </button>
            <img
              src={preview.url}
              alt={`${preview.originalName} 원본`}
              className="max-h-[calc(90vh-1.5rem)] max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}
