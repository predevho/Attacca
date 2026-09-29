package com.back.domain.performance.controller;

import com.back.domain.performance.dto.PublicPerformanceResponse;
import com.back.domain.performance.dto.PublicPerformanceScope;
import com.back.domain.performance.service.PerformanceService;
import com.back.global.common.ApiResponse;
import com.back.global.common.PageResponse;
import com.back.global.common.PageRequestPolicy;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공연 공개 조회. 인증이 필요 없다({@code /api/public/**} permitAll).
 * 읽기만 둔다 — 등록·수정·삭제는 인증 경로({@code /api/performances})에 그대로 있다.
 */
@RestController
@RequestMapping("/api/public/performances")
@RequiredArgsConstructor
public class PerformancePublicController {

    private final PerformanceService performanceService;

    @GetMapping
    public ApiResponse<PageResponse<PublicPerformanceResponse>> list(
            @RequestParam(defaultValue = "UPCOMING") PublicPerformanceScope scope,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return ApiResponse.success(performanceService.getPublicPerformances(scope, from, to,
                PageRequestPolicy.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<PublicPerformanceResponse> get(@PathVariable Long id) {
        return ApiResponse.success(performanceService.getPublicPerformance(id));
    }

}
