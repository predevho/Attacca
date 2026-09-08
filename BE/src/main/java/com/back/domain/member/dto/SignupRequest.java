package com.back.domain.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 자체 회원가입 요청. 규칙과 근거는 DOMAIN-MEMBER-STATUTE §3.3.
 *
 * <p>비밀번호 확인(재입력)은 화면에서만 다룬다 — 서버가 확인할 것이 없고,
 * 같은 비밀번호를 한 번 더 실어 보낼 이유도 없다.
 */
public record SignupRequest(
        @NotBlank(message = "아이디를 입력해 주세요.")
        @Pattern(regexp = "^[a-z0-9_]{4,20}$",
                message = "아이디는 영문 소문자·숫자·밑줄 4~20자여야 합니다.")
        String loginId,

        // 길이를 기준으로 삼는다. 특수문자를 강제하면 오히려 예측 가능한 변형(Password1!)을
        // 부른다는 것이 NIST 권고다. 상한 64자는 BCrypt의 72바이트 한계보다 낮게 잡은 것.
        @NotBlank(message = "비밀번호를 입력해 주세요.")
        @Size(min = 8, max = 64, message = "비밀번호는 8자 이상 64자 이하여야 합니다.")
        @Pattern(regexp = "^\\S+$", message = "비밀번호에 공백은 쓸 수 없습니다.")
        String password,

        @NotBlank(message = "이메일을 입력해 주세요.")
        @Email(message = "이메일 형식이 올바르지 않습니다.")
        @Size(max = 254, message = "이메일이 너무 깁니다.")
        String email,

        // 저장 전에 trim 한다(MemberService). MySQL 기본 collation이 후행 공백을 무시해,
        // 다듬지 않으면 "홍길동"과 "홍길동 "이 같은 값으로 비교된다.
        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Pattern(regexp = "^\\s*\\S(.*\\S)?\\s*$", message = "닉네임을 입력해 주세요.")
        @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하여야 합니다.")
        String nickname) {
}
