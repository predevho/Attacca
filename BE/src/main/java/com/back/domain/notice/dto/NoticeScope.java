package com.back.domain.notice.dto;

/** 공개 목록 조회 범위. 쿼리 파라미터는 상수명 그대로 대문자로 받는다(소문자는 400-01). */
public enum NoticeScope {
    /** 홈 캐러셀용 — pinned만, 최신순. 상한은 컨트롤러가 5건으로 제한한다. */
    PINNED,
    /** 홈 달력용 — scheduledAt이 [from, to) 범위, 이른 순. from/to 필수. */
    SCHEDULED,
    /** 전체(미삭제) — 최신순. */
    ALL
}
