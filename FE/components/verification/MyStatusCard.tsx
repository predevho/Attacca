import { statusLabel } from '@/lib/verification/logic';
import type { Application } from '@/lib/verification/types';

const MESSAGE: Record<Application['status'], string> = {
  PENDING: '심사 중입니다. 결과를 기다려 주세요.',
  APPROVED: '인증 연주자로 승인되었습니다.',
  REJECTED: '신청이 거절되었습니다.',
  REVOKED: '인증이 철회되었습니다.',
};

export function MyStatusCard({ application }: { application: Application }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4" aria-label={`상태: ${statusLabel(application.status)}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{MESSAGE[application.status]}</p>
      </div>
      <div className="text-sm text-gray-700">
        <span className="text-gray-500">지원 사유</span>
        <p className="whitespace-pre-wrap">{application.statement}</p>
      </div>
      {application.evidenceUrls.length > 0 && (
        <ul className="text-sm">
          {application.evidenceUrls.map((u, i) => (
            <li key={i}><a href={u} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{u}</a></li>
          ))}
        </ul>
      )}
      {application.decisionReason && (
        <div className="text-sm text-gray-700">
          <span className="text-gray-500">처리 사유</span>
          <p className="whitespace-pre-wrap">{application.decisionReason}</p>
        </div>
      )}
    </div>
  );
}
