package com.back.domain.member.dto;

/** 로그인 성공 시 발급하는 토큰 쌍(access + refresh). isNewMember는 닉네임 온보딩 필요 여부다. */
public record TokenPairResponse(String accessToken, String refreshToken, boolean isNewMember) {

    /** 일반 로그인·기존 계정 로그인과의 소스 호환을 위한 기본 생성자. */
    public TokenPairResponse(String accessToken, String refreshToken) {
        this(accessToken, refreshToken, false);
    }
}
