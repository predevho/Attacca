package com.back.domain.performance.controller;

import com.back.domain.performance.dto.PerformanceRequest;
import com.back.domain.performance.dto.PerformanceResponse;
import com.back.domain.performance.dto.PerformanceScope;
import com.back.domain.performance.service.PerformanceService;
import com.back.global.common.ApiResponse;
import com.back.global.common.PageResponse;
import com.back.global.common.PageRequestPolicy;
import com.back.global.security.AuthorizationRoles;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 연주회 API. 모두 인증 필요(principal = memberId).
 * 등록은 인증 연주자 또는 어드민(서비스에서 판정), 모더레이션 삭제는 역할로 판정 — 어드민 전용 경로 없음.
 */
@RestController
@RequestMapping("/api/performances")
@RequiredArgsConstructor
public class PerformanceController {

    private final PerformanceService performanceService;

    @PostMapping
    public ApiResponse<PerformanceResponse> register(@AuthenticationPrincipal Long memberId,
            Authentication authentication, @Valid @RequestBody PerformanceRequest request) {
        return ApiResponse.success(
                performanceService.register(memberId, AuthorizationRoles.isAdmin(authentication), request));
    }

    @GetMapping
    public ApiResponse<PageResponse<PerformanceResponse>> list(
            @RequestParam(defaultValue = "UPCOMING") PerformanceScope scope,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return ApiResponse.success(PageResponse.from(performanceService.getPerformances(scope,
                PageRequestPolicy.of(page, size))));
    }

    @GetMapping("/{id}")
    public ApiResponse<PerformanceResponse> get(@PathVariable Long id) {
        return ApiResponse.success(performanceService.getPerformance(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<PerformanceResponse> edit(@AuthenticationPrincipal Long memberId,
            @PathVariable Long id, @Valid @RequestBody PerformanceRequest request) {
        return ApiResponse.success(performanceService.editPerformance(memberId, id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Long memberId,
            Authentication authentication, @PathVariable Long id) {
        performanceService.deletePerformance(memberId, AuthorizationRoles.isAdmin(authentication), id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/poster")
    public ApiResponse<PerformanceResponse> poster(@AuthenticationPrincipal Long memberId,
            @PathVariable Long id, @RequestPart("file") MultipartFile file) {
        return ApiResponse.success(performanceService.updatePoster(memberId, id, file));
    }

}
