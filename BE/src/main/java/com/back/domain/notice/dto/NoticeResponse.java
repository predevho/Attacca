package com.back.domain.notice.dto;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.notice.entity.NoticeType;
import java.time.LocalDateTime;

/** 어드민 응답. 작성자·pinned·수정시각까지 포함한다(공개 응답과 별도 클래스 — STATUTE §6). */
public record NoticeResponse(
        Long id,
        MemberDisplay author,
        NoticeType type,
        String title,
        String content,
        LocalDateTime scheduledAt,
        String place,
        boolean pinned,
        String coverImageUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
