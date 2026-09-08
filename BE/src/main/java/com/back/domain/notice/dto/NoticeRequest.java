package com.back.domain.notice.dto;

import com.back.domain.notice.entity.NoticeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 공지 등록/수정 공용 요청(전체 교체).
 *
 * <p>{@code type == EVENT}일 때 {@code scheduledAt}이 필수라는 규칙은 필드 간 관계라
 * Bean Validation 단일 필드 제약으로 표현할 수 없다. 서비스 계층에서 검증한다(STATUTE §3).
 */
public record NoticeRequest(
        @NotNull(message = "종류를 선택해 주세요.") NoticeType type,
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = 100, message = "제목은 100자를 넘을 수 없습니다.") String title,
        @NotBlank(message = "본문을 입력해 주세요.")
        @Size(max = 5000, message = "본문은 5000자를 넘을 수 없습니다.") String content,
        LocalDateTime scheduledAt,
        @Size(max = 200, message = "장소는 200자를 넘을 수 없습니다.") String place,
        boolean pinned) {
}
