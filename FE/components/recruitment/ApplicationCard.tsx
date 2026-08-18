import { applicationStatusLabel } from '@/lib/recruitment/logic';
import type { Application } from '@/lib/recruitment/types';

export function ApplicationCard({
  application, onWithdraw, onOpen,
}: {
  application: Application;
  onWithdraw: (applicationId: number) => void;
  onOpen: () => void;
}) {
  return (
    <article className="rounded border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onOpen} className="text-sm text-brand-strong underline">
          공고 #{application.postingId} 보기
        </button>
        <span className="text-xs text-ink-muted">{applicationStatusLabel(application.status)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{application.message}</p>
      {application.status === 'PENDING' && (
        <button type="button" onClick={() => onWithdraw(application.id)}
          className="mt-2 rounded border border-line px-3 py-1 text-xs">철회</button>
      )}
    </article>
  );
}
