export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export type Application = {
  id: number;
  memberId: number;
  /** 어드민 심사 목록에서만 채워진다. 탈퇴 등으로 표시정보가 없으면 null. */
  applicant: { id: number; nickname: string; verified: boolean } | null;
  statement: string;
  evidenceUrls: string[];
  status: VerificationStatus;
  decisionReason: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  createdAt: string;
};

/** 신청/재신청 폼 값. */
export type ApplyFormValues = { statement: string; evidenceUrls: string[] };

/** 어드민 직접지정 폼 값(입력은 문자열, 전송 시 변환). */
export type GrantFormValues = { memberId: string; reason: string };

/** Spring Page 응답 중 FE가 쓰는 필드만. */
export type SpringPage<T> = { content: T[]; number: number; totalPages: number; last: boolean };
