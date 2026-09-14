package com.back.domain.imports.controller;

import com.back.domain.imports.dto.ImportRunResponse;
import com.back.domain.imports.dto.ImportRunStatusResponse;
import com.back.domain.imports.dto.ImportApproveRequest;
import com.back.domain.imports.dto.ImportApproveResponse;
import com.back.domain.imports.service.ImportReviewService;
import com.back.domain.imports.entity.ImportSource;
import com.back.domain.imports.service.ImportScheduleService;
import com.back.global.common.ApiResponse;
import com.back.global.common.PageResponse;
import com.back.domain.imports.dto.ImportedItemResponse;
import com.back.domain.imports.entity.ImportStatus;
import com.back.domain.imports.repository.ImportedItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/imports")
@RequiredArgsConstructor
public class ImportAdminController {
    private final ImportScheduleService scheduleService;
    private final ImportReviewService reviewService;
    private final ImportedItemRepository itemRepository;

    @GetMapping
    public ApiResponse<PageResponse<ImportedItemResponse>> list(
            @RequestParam(required = false, defaultValue = "NEW") ImportStatus status,
            @RequestParam(required = false) ImportSource source,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        var result = itemRepository.findAllByFilters(status, source,
                PageRequest.of(Math.max(page, 0), safeSize,
                        Sort.by(Sort.Direction.DESC, "createdAt", "id")))
                .map(ImportedItemResponse::from);
        return ApiResponse.success(PageResponse.from(result));
    }

    @PostMapping("/runs")
    public ApiResponse<ImportRunResponse> run(@RequestParam ImportSource source) {
        scheduleService.submitManual(source);
        return ApiResponse.success(new ImportRunResponse(source.name(), "ACCEPTED"));
    }

    @GetMapping("/runs/latest")
    public ApiResponse<ImportRunStatusResponse> latest(@RequestParam(required = false) ImportSource source) {
        Optional<ImportRunStatusResponse> response = scheduleService.latest(source).map(ImportRunStatusResponse::from);
        return ApiResponse.success(response.orElse(null));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<ImportApproveResponse> approve(@AuthenticationPrincipal Long adminId,
            @PathVariable long id, @Valid @RequestBody ImportApproveRequest request) {
        return ApiResponse.success(reviewService.approve(adminId, id, request));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<Void> reject(@PathVariable long id) {
        reviewService.reject(id);
        return ApiResponse.success();
    }
}
