package com.back.domain.member.dto;

import jakarta.validation.constraints.NotBlank;

/** 자체 로그인 요청. 빈 값은 서비스까지 보내지 않는다. */
public record LoginRequest(
        @NotBlank(message = "아이디를 입력해 주세요.") String loginId,
        @NotBlank(message = "비밀번호를 입력해 주세요.") String password) {
}
