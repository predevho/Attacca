package com.back.domain.notice.controller;

import com.back.domain.notice.dto.NoticeScope;
import com.back.domain.notice.dto.PublicNoticeResponse;
import com.back.domain.notice.service.NoticeService;
import com.back.global.common.ApiResponse;
import com.back.global.common.PageResponse;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공지 공개 조회. 인증이 필요 없다({@code /api/public/**} permitAll).
 *
 * <p>어드민 컨트롤러와 클래스를 나눈 것은 의도적이다 — 하나의 컨트롤러에서 인증 여부로 분기하면
 * 나중에 누군가 쓰기 메서드를 여기 추가해도 눈에 띄지 않는다. 이 클래스에는 읽기만 둔다(STATUTE §6).
 */
@RestController
@RequestMapping("/api/public/notices")
@RequiredArgsConstructor
public class NoticePublicController {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;
    /** 캐러셀은 몇 장만 넘긴다. 20장이 꽂히면 아무도 끝까지 보지 않는다. */
    private static final int PINNED_MAX_SIZE = 5;

    private final NoticeService noticeService;

    @GetMapping
    public ApiResponse<PageResponse<PublicNoticeResponse>> list(
            @RequestParam(defaultValue = "ALL") NoticeScope scope,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return ApiResponse.success(noticeService.getPublicNotices(scope, from, to,
                PageRequest.of(Math.max(page, 0), clamp(scope, size))));
    }

    @GetMapping("/{id}")
    public ApiResponse<PublicNoticeResponse> get(@PathVariable Long id) {
        return ApiResponse.success(noticeService.getPublicNotice(id));
    }

    private int clamp(NoticeScope scope, int size) {
        int max = scope == NoticeScope.PINNED ? PINNED_MAX_SIZE : MAX_SIZE;
        if (size < 1) {
            return Math.min(DEFAULT_SIZE, max);
        }
        return Math.min(size, max);
    }
}
