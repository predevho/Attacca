package com.back.domain.member.dto;

/** 로그인 성공 시 발급하는 access와 서버 관리 refresh 세션. isNewMember는 닉네임 온보딩 필요 여부다. */
public record TokenPairResponse(String accessToken, String refreshSession, boolean isNewMember,
                                String onboardingTicket) {

    /** 일반 로그인·기존 계정 로그인과의 소스 호환을 위한 기본 생성자. */
    public TokenPairResponse(String accessToken, String refreshSession) {
        this(accessToken, refreshSession, false, null);
    }

    public TokenPairResponse(String accessToken, String refreshSession, boolean isNewMember) {
        this(accessToken, refreshSession, isNewMember, null);
    }
}
