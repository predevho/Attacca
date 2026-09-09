package com.back.domain.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberConsentRepository;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.jwt.JwtProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원 탈퇴 (DOMAIN-MEMBER-STATUTE §3.6).
 *
 * <p>핵심은 <b>사람은 지우고 글은 남긴다</b>는 것과, 지웠다면 실제로 못 돌아온다는 것이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MemberWithdrawTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberConsentRepository consentRepository;

    @Autowired
    private JwtProvider jwtProvider;

    private Long signup(String loginId, String email, String nickname) throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "loginId", loginId, "password", "goodpassword",
                                "email", email, "nickname", nickname,
                                "agreedTerms", true, "agreedPrivacy", true))))
                .andExpect(status().isOk());
        return memberRepository.findByLoginId(loginId).orElseThrow().getId();
    }

    private String accessTokenFor(Long memberId) {
        return jwtProvider.createAccessToken(memberId,
                memberRepository.findById(memberId).orElseThrow().getRole());
    }

    @Test
    @DisplayName("탈퇴하면 개인 식별 정보가 사라진다")
    void erasesIdentity() throws Exception {
        Long id = signup("leaver", "leave@attacca.com", "떠날사람");

        mockMvc.perform(delete("/api/members/me")
                        .header("Authorization", "Bearer " + accessTokenFor(id)))
                .andExpect(status().isOk());

        Member after = memberRepository.findById(id).orElseThrow();
        assertThat(after.isWithdrawn()).isTrue();
        assertThat(after.getLoginId()).isNull();
        assertThat(after.getPassword()).isNull();
        assertThat(after.getEmail()).isEqualTo("deleted-" + id + "@attacca.invalid");
        assertThat(after.getNickname()).isEqualTo("탈퇴한회원" + id);
    }

    @Test
    @DisplayName("회원 행 자체는 남는다 — 글의 작성자 참조가 끊기면 안 된다")
    void keepsTheRow() throws Exception {
        Long id = signup("keeprow", "keep@attacca.com", "행유지");

        mockMvc.perform(delete("/api/members/me")
                        .header("Authorization", "Bearer " + accessTokenFor(id)))
                .andExpect(status().isOk());

        assertThat(memberRepository.findById(id)).isPresent();
    }

    @Test
    @DisplayName("탈퇴한 아이디로는 다시 로그인할 수 없다")
    void cannotLoginAfterWithdrawal() throws Exception {
        Long id = signup("gone", "gone@attacca.com", "사라짐");
        mockMvc.perform(delete("/api/members/me")
                        .header("Authorization", "Bearer " + accessTokenFor(id)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("loginId", "gone", "password", "goodpassword"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-07"));
    }

    @Test
    @DisplayName("비운 아이디를 다른 사람이 다시 쓸 수 있다")
    void freesTheLoginId() throws Exception {
        Long id = signup("reuse", "reuse@attacca.com", "재사용");
        mockMvc.perform(delete("/api/members/me")
                        .header("Authorization", "Bearer " + accessTokenFor(id)))
                .andExpect(status().isOk());

        // loginId 를 null 로 비웠으므로 유니크 제약에 걸리지 않는다.
        assertThat(signup("reuse", "reuse2@attacca.com", "재사용2")).isNotEqualTo(id);
    }

    @Test
    @DisplayName("동의 이력은 남긴다")
    void keepsConsentHistory() throws Exception {
        Long id = signup("consentkeep", "ck@attacca.com", "동의유지");
        mockMvc.perform(delete("/api/members/me")
                        .header("Authorization", "Bearer " + accessTokenFor(id)))
                .andExpect(status().isOk());

        // 이 표에는 개인 식별 정보가 없고, "동의를 받았는가"에 답하려면 필요하다.
        assertThat(consentRepository.findByMemberIdOrderByAgreedAtDesc(id)).hasSize(2);
    }

    @Test
    @DisplayName("두 번 탈퇴할 수 없다")
    void cannotWithdrawTwice() throws Exception {
        Long id = signup("twice", "twice@attacca.com", "두번");
        String token = accessTokenFor(id);

        mockMvc.perform(delete("/api/members/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/members/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.resultCode").value("409-07"));
    }

    @Test
    @DisplayName("인증 없이는 탈퇴시킬 수 없다")
    void requiresAuth() throws Exception {
        mockMvc.perform(delete("/api/members/me"))
                .andExpect(status().isUnauthorized());
    }
}
