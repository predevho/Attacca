package com.back.global.security.auth.dto;

/**
 * 재발급 응답. 로테이션 도입으로 refresh도 함께 새로 주므로 access만 담던
 * {@link TokenResponse}로는 부족하다. 소비처(FE BFF)는 쿠키 두 개를 모두 갱신해야 한다.
 */
public record TokenPairResponse(String accessToken, String refreshToken) {
}
