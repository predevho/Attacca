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
    <article className="rounded border p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onOpen} className="text-sm text-indigo-600 underline">
          공고 #{application.postingId} 보기
        </button>
        <span className="text-xs text-gray-500">{applicationStatusLabel(application.status)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{application.message}</p>
      {application.status === 'PENDING' && (
        <button type="button" onClick={() => onWithdraw(application.id)}
          className="mt-2 rounded border px-3 py-1 text-xs">철회</button>
      )}
    </article>
  );
}
