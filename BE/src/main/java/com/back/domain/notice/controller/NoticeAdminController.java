package com.back.domain.notice.controller;

import com.back.domain.notice.dto.request.NoticeRequest;
import com.back.domain.notice.dto.response.NoticeResponse;
import com.back.domain.notice.entity.NoticeType;
import com.back.domain.notice.service.NoticeCommandService;
import com.back.domain.notice.service.NoticeQueryService;
import com.back.global.common.ApiResponse;
import com.back.global.common.PageResponse;
import com.back.global.common.PageRequestPolicy;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
 * 공지 관리 API. 경로가 {@code /api/admin/**}이라 SecurityConfig의
 * {@code requestMatchers("/api/admin/**").hasRole("ADMIN")}이 권한을 막는다 — 여기서 다시 판정하지 않는다.
 */
@RestController
@RequestMapping("/api/admin/notices")
@RequiredArgsConstructor
public class NoticeAdminController {

    private final NoticeCommandService noticeCommandService;
    private final NoticeQueryService noticeQueryService;

    @PostMapping
    public ApiResponse<NoticeResponse> register(@AuthenticationPrincipal Long adminId,
            @Valid @RequestBody NoticeRequest request) {
        return ApiResponse.success(noticeCommandService.register(adminId, request));
    }

    @GetMapping
    public ApiResponse<PageResponse<NoticeResponse>> list(
            @RequestParam(required = false) NoticeType type,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return ApiResponse.success(noticeQueryService.getAdminNotices(type,
                PageRequestPolicy.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<NoticeResponse> get(@PathVariable Long id) {
        return ApiResponse.success(noticeQueryService.getAdminNotice(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<NoticeResponse> edit(@PathVariable Long id,
            @Valid @RequestBody NoticeRequest request) {
        return ApiResponse.success(noticeCommandService.editNotice(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        noticeCommandService.deleteNotice(id);
        return ApiResponse.success();
    }

    @PutMapping("/{id}/cover")
    public ApiResponse<NoticeResponse> cover(@AuthenticationPrincipal Long adminId,
            @PathVariable Long id, @RequestPart("file") MultipartFile file) {
        return ApiResponse.success(noticeCommandService.updateCover(adminId, id, file));
    }

}
