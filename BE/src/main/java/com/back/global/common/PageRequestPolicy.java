package com.back.global.common;

import org.springframework.data.domain.PageRequest;

/** 목록 API의 기본 페이지 요청 규칙. */
public final class PageRequestPolicy {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;

    private PageRequestPolicy() {
    }

    public static PageRequest of(int page, int size) {
        return PageRequest.of(Math.max(page, 0), size(size));
    }

    public static int size(int size) {
        if (size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }
}
