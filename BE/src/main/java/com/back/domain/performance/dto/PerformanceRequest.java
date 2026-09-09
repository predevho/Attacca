package com.back.domain.performance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** 공연 등록/수정 공용 요청(전체 교체). */
public record PerformanceRequest(
        @NotBlank(message = "공연명을 입력해 주세요.")
        @Size(max = 100, message = "공연명은 100자를 넘을 수 없습니다.") String title,
        @Size(max = 2000, message = "소개는 2000자를 넘을 수 없습니다.") String description,
        @NotNull(message = "공연 일시를 입력해 주세요.") LocalDateTime performedAt,
        @NotBlank(message = "장소를 입력해 주세요.")
        @Size(max = 200, message = "장소는 200자를 넘을 수 없습니다.") String venue,
        @Size(max = 2000, message = "프로그램은 2000자를 넘을 수 없습니다.") String program,
        @Size(max = 200, message = "관람료 안내는 200자를 넘을 수 없습니다.") String ticketInfo,
        // 화면이 <a href>로 그리고, 공연 상세는 비로그인 공개 화면이다.
        // javascript:/data: 가 저장되면 링크를 누른 방문자에게서 스크립트가 돈다(저장형 XSS).
        @Size(max = 500, message = "링크는 500자를 넘을 수 없습니다.")
        @Pattern(regexp = "^\\s*(https?://\\S+)?\\s*$",
                message = "예매 링크는 http:// 또는 https:// 형식이어야 합니다.") String ticketUrl) {
}
