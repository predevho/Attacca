package com.back.domain.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.repository.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원가입·로그인 입력 검증 (DOMAIN-MEMBER-STATUTE §3.3).
 *
 * <p>2026-09-09 이전에는 검증이 하나도 없어서 운영에서 비밀번호 {@code 1} /
 * 이메일 {@code not-an-email} / 닉네임 공백 한 칸으로 가입과 로그인이 됐다.
 * 다른 도메인 DTO에는 검증이 있었는데 가장 바깥 입구인 MEMBER만 빠져 있었다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MemberAuthValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MemberRepository memberRepository;

    private String signupJson(String loginId, String password, String email, String nickname)
            throws Exception {
        return objectMapper.writeValueAsString(
                Map.of("loginId", loginId, "password", password, "email", email, "nickname", nickname));
    }

    private void expectRejected(String loginId, String password, String email, String nickname)
            throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(loginId, password, email, nickname)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    @DisplayName("운영에서 실제로 통과했던 조합을 막는다")
    void rejectsWhatUsedToPass() throws Exception {
        // 2026-09-09 운영에서 이 요청이 200으로 가입됐고 로그인까지 됐다.
        expectRejected("vcheck1", "1", "not-an-email", " ");
    }

    @ParameterizedTest(name = "[{index}] {4}")
    @CsvSource(delimiter = '|', value = {
            "abc      | goodpassword | a@attacca.com | 닉네임 | 아이디가 4자 미만",
            "Uppercase| goodpassword | a@attacca.com | 닉네임 | 아이디에 대문자",
            "has space| goodpassword | a@attacca.com | 닉네임 | 아이디에 공백",
            "han글    | goodpassword | a@attacca.com | 닉네임 | 아이디에 한글",
            "gooduser | short7c      | a@attacca.com | 닉네임 | 비밀번호가 8자 미만",
            "gooduser | with space12 | a@attacca.com | 닉네임 | 비밀번호에 공백",
            "gooduser | goodpassword | not-an-email  | 닉네임 | 이메일 형식이 아님",
            "gooduser | goodpassword | a@attacca.com | 한     | 닉네임이 2자 미만",
            "gooduser | goodpassword | a@attacca.com | '  '   | 닉네임이 공백뿐",
    })
    void rejectsInvalidInput(String loginId, String password, String email, String nickname,
            String why) throws Exception {
        expectRejected(loginId.trim(), password.trim(), email.trim(), nickname);
    }

    @Test
    @DisplayName("닉네임 앞뒤 공백은 다듬어 저장한다")
    void trimsNickname() throws Exception {
        // MySQL 기본 collation은 후행 공백을 무시한다. 서버가 다듬지 않으면
        // "홍길동"과 "홍길동 "이 같은 값으로 비교돼 유니크 제약이 의도와 다르게 걸린다.
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("trimuser", "goodpassword", "trim@attacca.com", "  다듬김  ")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("다듬김"));

        assertThat(memberRepository.findByLoginId("trimuser"))
                .get().extracting("nickname").isEqualTo("다듬김");
    }

    @Test
    @DisplayName("빈 로그인 요청은 서비스까지 가지 않는다")
    void rejectsBlankLogin() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("loginId", "", "password", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }

    @Test
    @DisplayName("빈 소셜 로그인 요청도 막는다")
    void rejectsBlankOAuth() throws Exception {
        mockMvc.perform(post("/api/auth/oauth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "", "redirectUri", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-01"));
    }
}
