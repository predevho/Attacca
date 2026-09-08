package com.back.domain.notice.entity;

/**
 * 공지 글의 표시 분류. 데이터 제약이 아니라 홈에서 어떤 배지로 보일지를 가른다.
 * 달력 노출 여부는 이 값이 아니라 {@code scheduledAt}의 유무가 결정한다(STATUTE §5).
 */
public enum NoticeType {
    /** 공지 — 운영 안내. */
    NOTICE,
    /** 소식 — 서비스 안팎의 뉴스. */
    NEWS,
    /** 운영 일정 — 등록 시 scheduledAt 필수(날짜 없는 일정은 의미가 없다). */
    EVENT
}
