package com.back.domain.member.dto;

import jakarta.validation.constraints.NotBlank;

/** 소셜 로그인 요청. 프론트가 provider 로부터 받은 1회용 인가코드를 전달한다. */
public record OAuthLoginRequest(
        @NotBlank(message = "인가 코드가 없습니다.") String code,
        @NotBlank(message = "redirectUri 가 없습니다.") String redirectUri) {
}
