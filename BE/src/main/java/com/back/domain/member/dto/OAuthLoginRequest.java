package com.back.domain.member.dto;

import jakarta.validation.constraints.NotBlank;

/** 소셜 로그인 요청. 프론트가 provider 로부터 받은 1회용 인가코드를 전달한다. */
public record OAuthLoginRequest(
        @NotBlank(message = "인가 코드가 없습니다.") String code,
        @NotBlank(message = "redirectUri 가 없습니다.") String redirectUri,

        // 최초 가입인지는 코드를 교환해 봐야 안다. 그래서 FE가 카카오로 보내기 전에
        // 동의를 받아 두고 여기까지 실어 보낸다. BE는 **신규 생성 경로에서만** 요구한다 —
        // 이미 있는 회원의 로그인을 막지 않는다(DOMAIN-MEMBER-STATUTE §3.4).
        boolean agreedTerms,
        boolean agreedPrivacy) {
}
