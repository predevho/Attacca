package com.back.domain.member.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.member.dto.LoginRequest;
import com.back.domain.member.dto.SignupRequest;
import com.back.domain.member.dto.SignupResponse;
import com.back.domain.member.dto.TokenPairResponse;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.Role;
import com.back.global.security.jwt.JwtProperties;
import com.back.global.security.jwt.JwtProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@DataJpaTest
class MemberServiceTest {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private com.back.domain.member.repository.MemberConsentRepository consentRepository;

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtProvider jwtProvider = new JwtProvider(new JwtProperties(
            "test-secret-key-that-is-long-enough-for-hs256-0123456789", 1800000L, 1209600000L));
    private final com.back.global.security.token.InMemoryRefreshTokenStore tokenStore =
            new com.back.global.security.token.InMemoryRefreshTokenStore();
    private final com.back.global.security.token.TokenIssuer tokenIssuer =
            new com.back.global.security.token.TokenIssuer(jwtProvider, tokenStore);
    private MemberService memberService;

    @BeforeEach
    void setUp() {
        memberService = new MemberService(memberRepository, passwordEncoder, tokenIssuer,
                new MemberConsentService(consentRepository));
    }

    @Test
    void signup_persistsWithEncodedPassword() {
        SignupResponse res = memberService.signup(
                new SignupRequest("jazzman", "raw-password", "user@attacca.com", "재즈맨", true, true));

        assertThat(res.loginId()).isEqualTo("jazzman");
        assertThat(res.role()).isEqualTo(Role.USER);
        Member stored = memberRepository.findByLoginId("jazzman").orElseThrow();
        assertThat(stored.getPassword()).isNotEqualTo("raw-password");
        assertThat(passwordEncoder.matches("raw-password", stored.getPassword())).isTrue();
    }

    @Test
    void signup_duplicateLoginId_throws() {
        memberRepository.save(Member.createLocal("dupuser", "x", "a@attacca.com", "닉A"));
        assertThatThrownBy(() -> memberService.signup(
                new SignupRequest("dupuser", "raw-password", "b@attacca.com", "닉B", true, true)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_ID_ALREADY_EXISTS);
    }

    @Test
    void signup_duplicateEmail_throws() {
        memberRepository.save(Member.createLocal("id1", "x", "dup@attacca.com", "닉A"));
        assertThatThrownBy(() -> memberService.signup(
                new SignupRequest("iduser2", "raw-password", "dup@attacca.com", "닉B", true, true)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    @Test
    void signup_duplicateNickname_throws() {
        memberRepository.save(Member.createLocal("id1", "x", "a@attacca.com", "중복닉"));
        assertThatThrownBy(() -> memberService.signup(
                new SignupRequest("iduser2", "raw-password", "b@attacca.com", "중복닉", true, true)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NICKNAME_ALREADY_EXISTS);
    }

    @Test
    void login_validCredentials_returnsTokens() {
        memberService.signup(new SignupRequest("jazzman", "raw-password", "user@attacca.com", "재즈맨", true, true));

        TokenPairResponse tokens = memberService.login(new LoginRequest("jazzman", "raw-password"));

        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(tokens.refreshToken()).isNotBlank();
        assertThat(jwtProvider.parse(tokens.accessToken()).get("type", String.class)).isEqualTo("access");
    }

    @Test
    void login_unknownLoginId_throwsLoginFailed() {
        assertThatThrownBy(() -> memberService.login(new LoginRequest("nobody", "raw-password")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_FAILED);
    }

    @Test
    void login_socialOnlyMember_cannotLoginByLoginId_throwsLoginFailed() {
        memberRepository.save(Member.createSocial("social@attacca.com", "소셜러"));
        // 소셜 전용 회원은 loginId 가 없으므로 loginId/password 로그인 경로로는 인증할 수 없다
        assertThatThrownBy(() -> memberService.login(new LoginRequest("social@attacca.com", "raw-password")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_FAILED);
    }

    @Test
    void login_wrongPassword_throwsLoginFailed() {
        memberService.signup(new SignupRequest("jazzman", "correct-password", "user@attacca.com", "재즈맨", true, true));
        assertThatThrownBy(() -> memberService.login(new LoginRequest("jazzman", "wrong-pw")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_FAILED);
    }
}
