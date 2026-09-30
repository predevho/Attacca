package com.back.global.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.global.exception.GlobalExceptionHandler;
import com.back.global.security.MemberRoleProvider;
import com.back.global.security.Role;
import com.back.global.security.auth.controller.AuthController;
import com.back.global.security.auth.dto.request.ReissueRequest;
import com.back.global.security.jwt.JwtProperties;
import com.back.global.security.jwt.JwtProvider;
import com.back.global.security.session.InMemoryRefreshSessionStore;
import com.back.global.security.token.TokenIssuer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AuthControllerTest {

    private final JwtProvider jwtProvider = new JwtProvider(new JwtProperties(
            "test-secret-key-that-is-long-enough-for-hs256-0123456789", 1800000L, 1209600000L));
    private final ObjectMapper objectMapper = new ObjectMapper();
    private InMemoryRefreshSessionStore store;
    private TokenIssuer tokenIssuer;
    private Role currentRole;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        store = new InMemoryRefreshSessionStore(Duration.ofDays(14));
        tokenIssuer = new TokenIssuer(jwtProvider, store);
        currentRole = Role.USER;
        MemberRoleProvider roleProvider = memberId -> currentRole;
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(tokenIssuer, store, roleProvider))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter())
                .build();
    }

    private String body(String refreshSession) throws Exception {
        return objectMapper.writeValueAsString(new ReissueRequest(refreshSession));
    }

    @Test
    void 유효한_refresh_session은_access만_새로_준다() throws Exception {
        String session = tokenIssuer.issue(1L, Role.USER).refreshSession();
        mockMvc.perform(post("/api/auth/reissue").contentType(MediaType.APPLICATION_JSON).content(body(session)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshSession").doesNotExist());
    }

    @Test
    void 없는_refresh_session은_거부된다() throws Exception {
        mockMvc.perform(post("/api/auth/reissue").contentType(MediaType.APPLICATION_JSON).content(body("unknown")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-09"));
    }

    @Test
    void 재발급은_현재_role을_쓴다() throws Exception {
        String session = tokenIssuer.issue(1L, Role.ADMIN).refreshSession();
        currentRole = Role.USER;
        String json = mockMvc.perform(post("/api/auth/reissue").contentType(MediaType.APPLICATION_JSON).content(body(session)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String access = json.replaceAll(".*\\\"accessToken\\\":\\\"([^\\\"]+)\\\".*", "$1");
        assertThat(jwtProvider.parse(access).get("role", String.class)).isEqualTo(Role.USER.authority());
    }

    @Test
    void 로그아웃은_세션을_철회하고_멱등이다() throws Exception {
        String session = tokenIssuer.issue(1L, Role.USER).refreshSession();
        mockMvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON).content(body(session)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON).content(body(session)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/auth/reissue").contentType(MediaType.APPLICATION_JSON).content(body(session)))
                .andExpect(status().isUnauthorized());
    }
}
