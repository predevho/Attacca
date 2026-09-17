package com.back.domain.member.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.dto.OAuthLoginRequest;
import com.back.domain.member.entity.OAuthProvider;
import com.back.domain.member.oauth.KakaoOAuthClient;
import com.back.domain.member.oauth.OAuthUserInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MemberAuthControllerOAuthTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private KakaoOAuthClient kakaoOAuthClient;

    @BeforeEach
    void setUp() {
        when(kakaoOAuthClient.provider()).thenReturn(OAuthProvider.KAKAO);
    }

    private String json(Object o) throws Exception {
        return objectMapper.writeValueAsString(o);
    }

    @Test
    void kakaoLogin_newVerifiedUser_returns200WithTokens() throws Exception {
        when(kakaoOAuthClient.fetch(any(), any()))
                .thenReturn(new OAuthUserInfo("kakao-1", "new@attacca.com", true, "카카오유저"));

        mockMvc.perform(post("/api/auth/oauth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new OAuthLoginRequest("auth-code", "https://app/cb"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.isNewMember").value(true));
    }

    @Test
    void kakaoLogin_unverifiedEmail_returns401() throws Exception {
        when(kakaoOAuthClient.fetch(any(), any()))
                .thenReturn(new OAuthUserInfo("kakao-2", "x@attacca.com", false, "미검증"));

        mockMvc.perform(post("/api/auth/oauth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new OAuthLoginRequest("auth-code", "https://app/cb"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-08"));
    }

    @Test
    void 신규_소셜_회원은_닉네임과_동의를_완료하기_전에는_일반_API를_쓸_수_없다() throws Exception {
        when(kakaoOAuthClient.fetch(any(), any()))
                .thenReturn(new OAuthUserInfo("kakao-onboarding", "onboarding@attacca.com", true, "임시"));

        MvcResult login = mockMvc.perform(post("/api/auth/oauth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(new OAuthLoginRequest("auth-code", "https://app/cb"))))
                .andExpect(status().isOk())
                .andReturn();
        String accessToken = objectMapper.readTree(login.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        mockMvc.perform(get("/api/feed/posts").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.message").value("닉네임과 필수 약관 동의를 완료해 주세요."));

        mockMvc.perform(patch("/api/members/me")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"완료닉\",\"agreedTerms\":true,\"agreedPrivacy\":true}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/feed/posts").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
    }
}
