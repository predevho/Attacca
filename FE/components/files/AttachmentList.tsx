import type { AttachmentFile } from '@/lib/feed/types';

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

/** 게시와 연결된 파일을 열람하는 읽기 전용 목록이다. */
export function AttachmentList({ attachments }: { attachments?: AttachmentFile[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <section aria-label="첨부 파일" className="mt-4 border-t border-line pt-3">
      <h2 className="mb-2 text-sm font-medium text-ink-muted">첨부 파일</h2>
      <ul className="divide-y divide-line rounded border border-line">
        {attachments.map((attachment) => (
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
    </section>
  );
}
