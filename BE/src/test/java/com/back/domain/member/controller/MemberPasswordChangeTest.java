package com.back.domain.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.jwt.JwtProvider;
import com.back.global.security.token.RefreshTokenStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 비밀번호 변경 (DOMAIN-MEMBER-STATUTE §3.5).
 *
 * <p>바꿀 방법이 없어서, 비밀번호가 새면 탈퇴 말고는 손쓸 방법이 없었다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MemberPasswordChangeTest {

    private static final String OLD = "oldpassword1";
    private static final String NEW = "newpassword2";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private RefreshTokenStore refreshTokenStore;

    private Long signup(String loginId) throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "loginId", loginId, "password", OLD,
                                "email", loginId + "@attacca.test", "nickname", loginId,
                                "agreedTerms", true, "agreedPrivacy", true))))
                .andExpect(status().isOk());
        return memberRepository.findByLoginId(loginId).orElseThrow().getId();
    }

    private String tokenFor(Long memberId) {
        return jwtProvider.createAccessToken(memberId,
                memberRepository.findById(memberId).orElseThrow().getRole());
    }

    private org.springframework.test.web.servlet.ResultActions change(
            Long memberId, String current, String next) throws Exception {
        return mockMvc.perform(put("/api/members/me/password")
                .header("Authorization", "Bearer " + tokenFor(memberId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                        Map.of("currentPassword", current, "newPassword", next))));
    }

    @Test
    @DisplayName("바뀐 비밀번호로 로그인되고 옛 것으로는 안 된다")
    void changesPassword() throws Exception {
        Long id = signup("changer");

        change(id, OLD, NEW).andExpect(status().isOk());

        Member after = memberRepository.findById(id).orElseThrow();
        assertThat(passwordEncoder.matches(NEW, after.getPassword())).isTrue();
        assertThat(passwordEncoder.matches(OLD, after.getPassword())).isFalse();
    }

    @Test
    @DisplayName("부른 본인은 새 토큰을 받아 계속 쓸 수 있다")
    void returnsFreshTokens() throws Exception {
        // 전부 끊고 끝내면 비밀번호를 바꾼 사람이 자기도 튕겨 나간다.
        Long id = signup("keepsession");

        change(id, OLD, NEW)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty());
    }

    @Test
    @DisplayName("다른 기기의 refresh 는 전부 끊는다")
    void revokesOtherSessions() throws Exception {
        // 비밀번호를 바꾸는 이유의 절반이 "남이 들어와 있을지 모른다" 인데,
        // 다른 기기를 끊지 않으면 바꾸나 마나다.
        Long id = signup("revoker");
        String otherDeviceJti = "other-device-jti";
        refreshTokenStore.save(id, otherDeviceJti);
        assertThat(refreshTokenStore.exists(id, otherDeviceJti)).isTrue();

        change(id, OLD, NEW).andExpect(status().isOk());

        assertThat(refreshTokenStore.exists(id, otherDeviceJti)).isFalse();
    }

    @Test
    @DisplayName("현재 비밀번호가 틀리면 바꾸지 않는다")
    void rejectsWrongCurrent() throws Exception {
        // 자리를 비운 사이 남이 쥔 화면으로 비밀번호가 바뀌면 계정을 통째로 빼앗긴다.
        Long id = signup("wrongcurrent");

        change(id, "notmypassword", NEW)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-05"));

        Member after = memberRepository.findById(id).orElseThrow();
        assertThat(passwordEncoder.matches(OLD, after.getPassword())).isTrue();
    }

    @Test
    @DisplayName("같은 값으로는 바꿀 수 없다")
    void rejectsSameValue() throws Exception {
        Long id = signup("samevalue");

        change(id, OLD, OLD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-06"));
    }

    @Test
    @DisplayName("새 비밀번호는 가입과 같은 규칙을 따른다")
    void appliesSignupRules() throws Exception {
        Long id = signup("rules");

        change(id, OLD, "short7c")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
        change(id, OLD, "with space12")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    @DisplayName("소셜 전용 회원은 바꿀 수 없다")
    void rejectsSocialOnly() throws Exception {
        // password 가 null 이라 확인할 현재 값이 없다.
        Member social = memberRepository.save(
                Member.createSocial("social@attacca.test", "소셜전용"));

        change(social.getId(), OLD, NEW)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-07"));
    }

    @Test
    @DisplayName("인증 없이는 바꿀 수 없다")
    void requiresAuth() throws Exception {
        mockMvc.perform(put("/api/members/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("currentPassword", OLD, "newPassword", NEW))))
                .andExpect(status().isUnauthorized());
    }
}
