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
        {/*
          제목이 없으면 "공고 #1"로만 보여 지원이 여러 건일 때 구분이 안 됐다.
          삭제된 공고는 제목이 오지 않으므로 그때만 번호로 떨어진다.
        */}
        <button type="button" onClick={onOpen}
          className="truncate text-left text-sm text-brand-strong underline">
          {application.postingTitle ?? `공고 #${application.postingId} (삭제됨)`}
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
