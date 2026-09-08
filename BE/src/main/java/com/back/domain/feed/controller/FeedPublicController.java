package com.back.domain.feed.controller;

import com.back.domain.feed.dto.PostSort;
import com.back.domain.feed.dto.PublicPostSummary;
import com.back.domain.feed.service.FeedPublicService;
import com.back.global.common.ApiResponse;
import com.back.global.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 게시글 공개 조회. 인증이 필요 없다({@code /api/public/**} permitAll). 목록만 연다 —
 * 단건 상세는 공개하지 않는다(홈에서 카드를 누르면 인증 경로의 상세로 가고, 거기서 로그인을 요구한다).
 */
@RestController
@RequestMapping("/api/public/feed/posts")
@RequiredArgsConstructor
public class FeedPublicController {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;

    private final FeedPublicService feedPublicService;

    @GetMapping
    public ApiResponse<PageResponse<PublicPostSummary>> list(
            @RequestParam(defaultValue = "LATEST") PostSort sort,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return ApiResponse.success(feedPublicService.getPublicPosts(sort,
                PageRequest.of(Math.max(page, 0), clamp(size))));
    }

    private int clamp(int size) {
        if (size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }
}
