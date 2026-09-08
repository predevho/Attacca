package com.back.global.security.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.global.exception.GlobalExceptionHandler;
import com.back.global.security.MemberRoleProvider;
import com.back.global.security.Role;
import com.back.global.security.auth.controller.AuthController;
import com.back.global.security.auth.dto.ReissueRequest;
import com.back.global.security.jwt.JwtProperties;
import com.back.global.security.jwt.JwtProvider;
import com.back.global.security.token.InMemoryRefreshTokenStore;
import com.back.global.security.token.TokenIssuer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** 재발급 로테이션·철회·재사용 감지. 규칙은 DOMAIN-COMMON-STATUTE §4.1. */
class AuthControllerTest {

    private final JwtProperties props = new JwtProperties(
            "test-secret-key-that-is-long-enough-for-hs256-0123456789", 1800000L, 1209600000L);
    private final JwtProvider jwtProvider = new JwtProvider(props);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private InMemoryRefreshTokenStore store;
    private TokenIssuer tokenIssuer;
    private Role currentRole;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        store = new InMemoryRefreshTokenStore();
        tokenIssuer = new TokenIssuer(jwtProvider, store);
        currentRole = Role.USER;
        MemberRoleProvider roleProvider = memberId -> currentRole;

        mockMvc = MockMvcBuilders
                .standaloneSetup(new AuthController(jwtProvider, tokenIssuer, store, roleProvider))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private String body(String refreshToken) throws Exception {
        return objectMapper.writeValueAsString(new ReissueRequest(refreshToken));
    }

    private String reissue(String refresh) throws Exception {
        return mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(refresh)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private String refreshFrom(String json) {
        return json.replaceAll(".*\"refreshToken\":\"([^\"]+)\".*", "$1");
    }

    @Test
    void 유효한_refresh는_access와_refresh를_둘_다_새로_준다() throws Exception {
        String refresh = tokenIssuer.issue(1L, Role.USER).refreshToken();

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(refresh)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty());
    }

    @Test
    void 재발급하면_옛_refresh는_즉시_무효가_된다() throws Exception {
        String first = tokenIssuer.issue(1L, Role.USER).refreshToken();

        reissue(first);

        // 같은 토큰을 다시 쓰면 거부된다(로테이션).
        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(first)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-09"));
    }

    @Test
    void 재사용이_감지되면_그_회원의_모든_기기가_무효화된다() throws Exception {
        // 두 기기에서 로그인한 상태
        String deviceA = tokenIssuer.issue(1L, Role.USER).refreshToken();
        String deviceB = tokenIssuer.issue(1L, Role.USER).refreshToken();

        // A가 한 번 갱신해서 옛 토큰이 무효가 된 뒤, 그 옛 토큰이 다시 온다(탈취 정황)
        reissue(deviceA);
        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(deviceA)))
                .andExpect(status().isUnauthorized());

        // 아직 멀쩡했던 B도 함께 끊긴다
        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(deviceB)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-09"));
    }

    @Test
    void 다른_기기는_서로의_갱신에_영향받지_않는다() throws Exception {
        String deviceA = tokenIssuer.issue(1L, Role.USER).refreshToken();
        String deviceB = tokenIssuer.issue(1L, Role.USER).refreshToken();

        reissue(deviceA);

        // B는 그대로 유효해야 한다(다중 기기 지원)
        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(deviceB)))
                .andExpect(status().isOk());
    }

    @Test
    void 재발급은_토큰이_아니라_DB의_현재_role을_쓴다() throws Exception {
        // ADMIN 상태에서 발급받은 refresh
        String refresh = tokenIssuer.issue(1L, Role.ADMIN).refreshToken();
        // 그 사이 강등됨
        currentRole = Role.USER;

        String json = reissue(refresh);
        String newAccess = json.replaceAll(".*\"accessToken\":\"([^\"]+)\".*", "$1");

        // 새 access의 role은 토큰에 남아 있던 ADMIN이 아니라 현재 값이어야 한다.
        assertThat(jwtProvider.parse(newAccess).get("role", String.class))
                .isEqualTo(Role.USER.authority());
    }

    @Test
    void 로그아웃하면_그_refresh는_못_쓴다() throws Exception {
        String refresh = tokenIssuer.issue(1L, Role.USER).refreshToken();

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(body(refresh)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(refresh)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-09"));
    }

    @Test
    void 로그아웃은_다른_기기를_끊지_않는다() throws Exception {
        String deviceA = tokenIssuer.issue(1L, Role.USER).refreshToken();
        String deviceB = tokenIssuer.issue(1L, Role.USER).refreshToken();

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(body(deviceA)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(deviceB)))
                .andExpect(status().isOk());
    }

    @Test
    void 이미_못_쓰는_토큰으로_로그아웃해도_성공이다() throws Exception {
        // 로그아웃은 멱등이어야 한다. 만료된 토큰으로 눌러도 사용자에게 오류를 보이지 않는다.
        JwtProvider expiredProvider = new JwtProvider(new JwtProperties(props.secret(), -1000L, -1000L));
        String expired = expiredProvider.createRefreshToken(1L, Role.USER, "dead-jti");

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON).content(body(expired)))
                .andExpect(status().isOk());
    }

    @Test
    void 화이트리스트에_없는_refresh는_401_09() throws Exception {
        // 저장소를 거치지 않고 만든 토큰 = 서명은 맞지만 등록된 적이 없다.
        String orphan = jwtProvider.createRefreshToken(1L, Role.USER, "never-registered");

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(orphan)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-09"));
    }

    @Test
    void jti가_없는_옛_토큰은_더는_통용되지_않는다() throws Exception {
        // 로테이션 도입 전에 발급된 refresh. 식별자가 없어 철회할 수단이 없으므로 거부한다.
        String legacy = jwtProvider.createRefreshToken(1L, Role.USER, null);

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(legacy)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-09"));
    }

    @Test
    void access를_refresh_자리에_넣으면_401_06() throws Exception {
        String access = jwtProvider.createAccessToken(1L, Role.USER);

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(access)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-06"));
    }

    @Test
    void 만료된_refresh는_401_04() throws Exception {
        JwtProvider expiredProvider = new JwtProvider(new JwtProperties(props.secret(), -1000L, -1000L));
        String refresh = expiredProvider.createRefreshToken(1L, Role.USER, "x");

        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(refresh)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.resultCode").value("401-04"));
    }

    @Test
    void 연속_갱신이_체인으로_이어진다() throws Exception {
        String r0 = tokenIssuer.issue(1L, Role.USER).refreshToken();

        String r1 = refreshFrom(reissue(r0));
        String r2 = refreshFrom(reissue(r1));

        assertThat(r2).isNotEqualTo(r1).isNotEqualTo(r0);
        mockMvc.perform(post("/api/auth/reissue")
                        .contentType(MediaType.APPLICATION_JSON).content(body(r2)))
                .andExpect(status().isOk());
    }
}
