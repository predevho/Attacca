package com.back.domain.performance.dto;

import com.back.domain.member.dto.PublicMemberDisplay;
import java.time.LocalDateTime;

/**
 * 비인증 조회 응답. 필드는 화이트리스트다(DOMAIN-NOTICE-STATUTE §6).
 *
 * <p>주최자는 닉네임·인증 뱃지만 담는다 — 누가 여는 공연인지는 홍보물의 핵심이라 노출하되,
 * 회원 id는 {@link PublicMemberDisplay}가 애초에 갖지 않는다.
 * 내부 상태({@code updatedAt}·삭제 여부)는 담지 않는다.
 */
public record PublicPerformanceResponse(
        Long id,
        PublicMemberDisplay organizer,
        String title,
        String description,
        LocalDateTime performedAt,
        String venue,
        String program,
        String ticketInfo,
        String ticketUrl,
        String posterImageUrl,
        LocalDateTime createdAt) {
}
