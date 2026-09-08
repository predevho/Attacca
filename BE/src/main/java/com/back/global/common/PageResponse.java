package com.back.global.common;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * 오프셋 페이징 응답의 안정적인 JSON 계약.
 *
 * <p>{@code Page<T>}(PageImpl)를 그대로 직렬화하면 Spring Boot 3.4가 "직렬화 비권장" 경고를 내고,
 * 무엇보다 구조가 프레임워크 내부 구현에 묶인다. 공개 API는 외부 계약이라 이 결합을 두면 안 되므로
 * NOTICE 도메인부터 이 DTO로 감싼다. 기존 도메인(VERIFIED-PERFORMER 어드민 목록·PERFORMANCE 목록)의
 * 전환은 별도 작업으로 BACKLOG에 남아 있다.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.isFirst(), page.isLast());
    }
}
