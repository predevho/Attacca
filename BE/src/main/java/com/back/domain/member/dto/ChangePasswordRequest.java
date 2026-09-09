package com.back.domain.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 변경 요청. 규칙은 DOMAIN-MEMBER-STATUTE §3.5.
 *
 * <p>새 비밀번호 제약은 가입(SignupRequest)과 **같게** 유지한다 —
 * 규칙이 갈리면 어느 한쪽이 약해진다.
 *
 * <p>확인 입력(재입력)은 화면에서만 다룬다. 서버로 보내지 않는다.
 */
public record ChangePasswordRequest(
        @NotBlank(message = "현재 비밀번호를 입력해 주세요.") String currentPassword,

        @NotBlank(message = "새 비밀번호를 입력해 주세요.")
        @Size(min = 8, max = 64, message = "비밀번호는 8자 이상 64자 이하여야 합니다.")
        @Pattern(regexp = "^\\S+$", message = "비밀번호에 공백은 쓸 수 없습니다.")
        String newPassword) {
}
