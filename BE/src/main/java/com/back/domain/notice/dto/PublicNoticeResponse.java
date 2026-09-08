package com.back.domain.notice.dto;

import com.back.domain.notice.entity.NoticeType;
import java.time.LocalDateTime;

/**
 * 비인증 조회 응답. 필드는 화이트리스트다 — 여기 적힌 것만 공개된다.
 *
 * <p>어드민 응답({@link NoticeResponse})과 클래스를 나눈 이유: 하나를 공유하면 나중에 필드가
 * 추가될 때 그것이 공개로 새는지 아무도 알아채지 못한다. 분리해 두면 공개 노출이 항상 명시적 선택이 된다.
 *
 * <p>작성자를 담지 않는다. 공지는 개인 명의가 아니라 운영 주체의 발언이고(CONSTITUTION §3),
 * 그 결과 회원 식별자도 공개 경로로 나가지 않는다.
 */
public record PublicNoticeResponse(
        Long id,
        NoticeType type,
        String title,
        String content,
        LocalDateTime scheduledAt,
        String place,
        String coverImageUrl,
        LocalDateTime createdAt) {
}
