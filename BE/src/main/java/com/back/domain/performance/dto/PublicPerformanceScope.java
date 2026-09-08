package com.back.domain.performance.dto;

/**
 * 공개 공연 목록 조회 범위. 인증 경로의 {@link PerformanceScope}와 분리해 둔 이유는
 * 달력용 범위 조회(SCHEDULED)가 공개 경로에만 필요하기 때문이다 — 공용 enum에 값을 더하면
 * 인증 경로에서도 의미 없는 값을 받게 된다.
 *
 * <p>SCHEDULED의 이름은 NOTICE의 같은 값과 맞췄다. 홈 달력은 두 도메인을 같은 모양으로 호출한다.
 */
public enum PublicPerformanceScope {
    /** 다가오는 공연 — 지금 이후, 가까운 순. */
    UPCOMING,
    /** 지난 공연 — 지금 이전, 최근 순. */
    PAST,
    /** 전체(미삭제) — 공연일 최신 순. */
    ALL,
    /** 홈 달력용 — performedAt이 [from, to) 범위, 이른 순. from/to 필수. */
    SCHEDULED
}
