package com.back.domain.recruitment.dto;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.recruitment.entity.RecruitmentApplication;
import com.back.domain.recruitment.entity.RecruitmentApplicationStatus;
import java.time.LocalDateTime;

public record RecruitmentApplicationResponse(
        Long id,
        Long postingId,
        /**
         * 어느 공고에 지원했는지. 제목이 없으면 '내 지원 현황'에서 "공고 #1"로만 보여
         * 지원이 여러 건일 때 구분이 안 된다(2026-09-09 화면에서 확인).
         * 삭제된 공고를 가리키면 null 이다.
         */
        String postingTitle,
        MemberDisplay applicant,
        String message,
        RecruitmentApplicationStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static RecruitmentApplicationResponse of(RecruitmentApplication a,
            MemberDisplay applicant, String postingTitle) {
        return new RecruitmentApplicationResponse(a.getId(), a.getPostingId(), postingTitle,
                applicant, a.getMessage(), a.getStatus(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
