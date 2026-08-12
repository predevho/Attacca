import { AuthorBadge } from '@/components/feed/AuthorBadge';
import { applicationStatusLabel } from '@/lib/recruitment/logic';
import type { Application } from '@/lib/recruitment/types';

export function ApplicantList({
  applications, onAccept, onReject,
}: {
  applications: Application[];
  onAccept: (applicationId: number) => void;
  onReject: (applicationId: number) => void;
}) {
  if (applications.length === 0) {
    return <p className="py-4 text-sm text-gray-400">아직 지원자가 없습니다.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {applications.map((a) => (
        <li key={a.id} className="rounded border p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm"><AuthorBadge author={a.applicant} /></div>
            <span className="text-xs text-gray-500">{applicationStatusLabel(a.status)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{a.message}</p>
          {a.status === 'PENDING' && (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => onAccept(a.id)}
                className="rounded bg-black px-3 py-1 text-xs text-white">수락</button>
              <button type="button" onClick={() => onReject(a.id)}
                className="rounded border px-3 py-1 text-xs">거절</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
