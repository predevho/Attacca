package com.back.domain.feed.dto;

/** 공개 게시글 목록 정렬. 쿼리 파라미터는 상수명 그대로 대문자로 받는다. */
public enum PostSort {
    /** 최신순(id 내림차순). */
    LATEST,
    /** 인기순 — 최근 기간 안에서 (좋아요 수 + 댓글 수)가 큰 순. */
    POPULAR
}
