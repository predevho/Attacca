package com.back.domain.feed.dto;

import com.back.domain.member.dto.PublicMemberDisplay;
import java.time.LocalDateTime;

/**
 * 비인증 조회용 게시글 요약. 필드는 화이트리스트다(DOMAIN-NOTICE-STATUTE §6).
 *
 * <p>{@link PostResponse}와 달리 {@code likedByMe}가 없다 — 보는 사람이 누군지 모르는 경로라
 * 애초에 계산할 수 없고, 있어서도 안 되는 값이다. {@code updatedAt}도 담지 않는다.
 * 작성자는 닉네임·인증 뱃지만(회원 id 없음).
 */
public record PublicPostSummary(
        Long id,
        PublicMemberDisplay author,
        String content,
        long likeCount,
        long commentCount,
        LocalDateTime createdAt) {
}
