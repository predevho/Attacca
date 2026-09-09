import type { CursorPage } from '@/lib/feed/types';
import type { ApplyFormValues, GrantFormValues, SpringPage, VerificationStatus } from '@/lib/verification/types';
import { isHttpUrl } from '@/lib/url';

/** Spring Page(오프셋)를 커서 페이지 계약으로 변환 → useInfiniteList 재사용. */
export function toCursorPage<T>(page: SpringPage<T>): CursorPage<T> {
  return { items: page.content, nextCursor: page.last ? null : page.number + 1 };
}

// 증빙 링크 가드는 공용(lib/url.ts)으로 올렸다. 기존 호출부를 위해 여기서 다시 내보낸다.
export { isHttpUrl };

/** 신청 폼 검증. 첫 에러 또는 null. BE ApplyRequest 규칙과 일치(빈 링크는 개수에서 제외). */
export function validateApply(v: ApplyFormValues): string | null {
  if (!v.statement.trim()) return '지원 사유를 입력해 주세요.';
  if (v.statement.length > 1000) return '지원 사유는 1000자를 넘을 수 없습니다.';
  const nonEmpty = v.evidenceUrls.filter((u) => u.trim() !== '');
  if (nonEmpty.length > 10) return '증빙 링크는 최대 10개까지 첨부할 수 있습니다.';
  if (nonEmpty.some((u) => !isHttpUrl(u))) return '증빙 링크는 http:// 또는 https:// 형식이어야 합니다.';
  return null;
}

/** 거절/철회 사유 검증(필수·≤500). */
export function validateReason(reason: string): string | null {
  if (!reason.trim()) return '처리 사유를 입력해 주세요.';
  if (reason.length > 500) return '처리 사유는 500자를 넘을 수 없습니다.';
  return null;
}

/** 직접지정 폼 검증(회원 id 양의 정수). reason은 BE 제한 없음. */
export function validateGrant(v: GrantFormValues): string | null {
  const n = Number(v.memberId);
  if (v.memberId.trim() === '' || !Number.isInteger(n) || n < 1) return '회원 id를 입력해 주세요.';
  return null;
}

export function statusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'PENDING': return '심사 중';
    case 'APPROVED': return '승인됨';
    case 'REJECTED': return '거절됨';
    case 'REVOKED': return '철회됨';
  }
}

/** 재신청 가능 여부. 활성 신청(PENDING/APPROVED)은 불가, 종료 상태만 가능. */
export function canReapply(status: VerificationStatus): boolean {
  return status === 'REJECTED' || status === 'REVOKED';
}

/** 폼 값 → 신청 요청. 빈/공백 링크 제거 + trim. */
export function toApplyRequest(v: ApplyFormValues) {
  return { statement: v.statement, evidenceUrls: v.evidenceUrls.map((u) => u.trim()).filter((u) => u !== '') };
}

/** 폼 값 → 직접지정 요청. memberId 숫자화, 빈 reason은 null(공백 trim). */
export function toGrantRequest(v: GrantFormValues) {
  const reason = v.reason.trim();
  return { memberId: Number(v.memberId), reason: reason === '' ? null : reason };
}
