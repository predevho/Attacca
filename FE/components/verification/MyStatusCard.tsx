import { isHttpUrl, statusLabel } from '@/lib/verification/logic';
import type { Application } from '@/lib/verification/types';

const MESSAGE: Record<Application['status'], string> = {
  PENDING: '심사 중입니다. 결과를 기다려 주세요.',
  APPROVED: '인증 연주자로 승인되었습니다.',
  REJECTED: '신청이 거절되었습니다.',
  REVOKED: '인증이 철회되었습니다.',
};

export function MyStatusCard({ application }: { application: Application }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4" aria-label={`상태: ${statusLabel(application.status)}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold">인증 신청 상태</h2>
        <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-ink-muted">{statusLabel(application.status)}</span>
      </div>
      <p className="text-sm font-medium">{MESSAGE[application.status]}</p>
      <fieldset className="text-sm text-ink-muted">
        <legend className="mb-1 font-medium text-ink-muted">지원 사유</legend>
        <p className="whitespace-pre-wrap">{application.statement}</p>
      </fieldset>
      {application.evidenceUrls.length > 0 && (
        <fieldset className="text-sm"><legend className="mb-1 font-medium text-ink-muted">증빙 링크</legend><ul className="flex flex-col gap-1">
          {application.evidenceUrls.map((u, i) => (
            <li key={i}>
              {isHttpUrl(u)
                ? <a href={u} target="_blank" rel="noreferrer" className="break-words text-brand-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{u}</a>
                : <span>{u}</span>}
            </li>
          ))}
        </ul></fieldset>
      )}
      {application.decisionReason && (
        <fieldset className="text-sm text-ink-muted"><legend className="mb-1 font-medium text-ink-muted">처리 사유</legend>
          <p className="whitespace-pre-wrap">{application.decisionReason}</p>
        </fieldset>
      )}
    </section>
  );
}
