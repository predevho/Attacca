package com.back.domain.recruitment.dto;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.entity.Instrument;
import com.back.domain.recruitment.entity.RecruitmentPosting;
import com.back.domain.recruitment.entity.RecruitmentStatus;
import com.back.global.storage.AttachmentResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public record RecruitmentPostingResponse(
        Long id,
        MemberDisplay author,
        String title,
        String description,
        Set<Instrument> instruments,
        Integer recruitCount,
        String location,
        String fee,
        LocalDateTime deadline,
        RecruitmentStatus status,
        boolean closed,
        List<AttachmentResponse> attachments,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static RecruitmentPostingResponse of(RecruitmentPosting p, MemberDisplay author,
            LocalDateTime now) {
        return new RecruitmentPostingResponse(p.getId(), author, p.getTitle(), p.getDescription(),
                Set.copyOf(p.getInstruments()), p.getRecruitCount(), p.getLocation(), p.getFee(),
                p.getDeadline(), p.getStatus(), p.isClosed(now), List.of(), p.getCreatedAt(),
                p.getUpdatedAt());
    }

    public static RecruitmentPostingResponse of(RecruitmentPosting p, MemberDisplay author,
            LocalDateTime now, List<AttachmentResponse> attachments) {
        return new RecruitmentPostingResponse(p.getId(), author, p.getTitle(), p.getDescription(),
                Set.copyOf(p.getInstruments()), p.getRecruitCount(), p.getLocation(), p.getFee(),
                p.getDeadline(), p.getStatus(), p.isClosed(now), attachments, p.getCreatedAt(),
                p.getUpdatedAt());
    }
}
