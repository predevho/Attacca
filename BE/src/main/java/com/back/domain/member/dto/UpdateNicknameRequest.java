package com.back.domain.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 본인 닉네임 부분 수정 요청. 가입 시와 같은 2~20자 규칙을 적용한다. */
public record UpdateNicknameRequest(
        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Pattern(regexp = "^\\s*\\S(.*\\S)?\\s*$", message = "닉네임을 입력해 주세요.")
        @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하여야 합니다.")
        String nickname) {
}
