package com.back.domain.verifiedperformer.dto;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.verifiedperformer.entity.VerificationApplication;
import com.back.domain.verifiedperformer.entity.VerificationStatus;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 인증 신청 응답. 내 신청 상태 조회와 어드민 목록에 공통으로 쓴다.
 * 어드민 처리 정보(decisionReason/decidedBy/decidedAt)는 PENDING 이면 null.
 *
 * <p>{@code applicant}는 어드민 심사 목록에서만 채운다. 내 상태 조회는 보는 사람이 곧
 * 신청자라 필요가 없고, 이 도메인은 MEMBER를 직접 참조하지 않으므로 조합은
 * {@code VerificationReviewService}가 한다.
 */
public record ApplicationResponse(
        Long id,
        Long memberId,
        MemberDisplay applicant,
        String statement,
        List<String> evidenceUrls,
        VerificationStatus status,
        String decisionReason,
        Long decidedBy,
        LocalDateTime decidedAt,
        LocalDateTime createdAt) {

    public static ApplicationResponse from(VerificationApplication application) {
        return new ApplicationResponse(
                application.getId(),
                application.getMemberId(),
                null,
                application.getStatement(),
                List.copyOf(application.getEvidenceUrls()),
                application.getStatus(),
                application.getDecisionReason(),
                application.getDecidedBy(),
                application.getDecidedAt(),
                application.getCreatedAt());
    }

    /** 신청자 표시정보를 채운 사본. 조회한 쪽(리뷰 서비스)이 붙인다. */
    public ApplicationResponse withApplicant(MemberDisplay display) {
        return new ApplicationResponse(id, memberId, display, statement, evidenceUrls,
                status, decisionReason, decidedBy, decidedAt, createdAt);
    }
}
