package com.back.global.security.auth.controller;

import com.back.global.common.ApiResponse;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.MemberRoleProvider;
import com.back.global.security.Role;
import com.back.global.security.auth.dto.ReissueRequest;
import com.back.global.security.auth.dto.TokenPairResponse;
import com.back.global.security.jwt.JwtProvider;
import com.back.global.security.token.RefreshTokenStore;
import com.back.global.security.token.TokenIssuer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 토큰 재발급·로그아웃. refresh만 서버가 기억한다(화이트리스트, DOMAIN-COMMON-STATUTE §4.1).
 * access는 여전히 무상태다 — 30분짜리라 블랙리스트를 두지 않는다.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtProvider jwtProvider;
    private final TokenIssuer tokenIssuer;
    private final RefreshTokenStore refreshTokenStore;
    private final MemberRoleProvider memberRoleProvider;

    /**
     * refresh 로테이션. 성공하면 access·refresh를 <b>둘 다</b> 새로 주고 옛 refresh는 즉시 무효화한다.
     *
     * <p>유효 목록에 없는 refresh가 오면 이미 쓰였거나 철회된 것이다. 정상 사용자는 그럴 일이 없으므로
     * 탈취로 보고 그 회원의 <b>모든 기기</b>를 무효화한다(공격자가 훔친 토큰을 먼저 써서
     * 진짜 사용자가 튕기는 경우까지 포함해, 어느 쪽이든 재로그인하게 만드는 것이 안전하다).
     */
    @PostMapping("/reissue")
    public ApiResponse<TokenPairResponse> reissue(@RequestBody ReissueRequest request) {
        Claims claims = parseRefresh(request.refreshToken());
        Long memberId = Long.valueOf(claims.getSubject());
        String jti = jwtProvider.getJti(claims);

        // jti가 없는 토큰 = 로테이션 도입 전에 발급된 것. 더는 통용시키지 않는다.
        if (jti == null || !refreshTokenStore.exists(memberId, jti)) {
            refreshTokenStore.removeAll(memberId);
            throw new BusinessException(ErrorCode.REVOKED_TOKEN);
        }

        // role을 토큰이 아니라 DB에서 다시 읽는다. 그러지 않으면 강등된 회원이
        // refresh 만료까지 옛 권한으로 access를 계속 받는다.
        Role role = memberRoleProvider.findRole(memberId);

        TokenIssuer.IssuedTokens tokens = tokenIssuer.issue(memberId, role);
        refreshTokenStore.remove(memberId, jti);
        return ApiResponse.success(
                new TokenPairResponse(tokens.accessToken(), tokens.refreshToken()));
    }

    /**
     * 로그아웃. 이 refresh 하나만 무효화한다(다른 기기는 살려 둔다).
     * 이미 무효인 토큰으로 호출해도 성공으로 응답한다 — 로그아웃은 멱등이어야 한다.
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody ReissueRequest request) {
        Claims claims;
        try {
            claims = parseRefresh(request.refreshToken());
        } catch (BusinessException e) {
            return ApiResponse.success(); // 만료·손상된 토큰이면 이미 못 쓴다. 조용히 성공.
        }
        String jti = jwtProvider.getJti(claims);
        if (jti != null) {
            refreshTokenStore.remove(Long.valueOf(claims.getSubject()), jti);
        }
        return ApiResponse.success();
    }

    private Claims parseRefresh(String token) {
        Claims claims;
        try {
            claims = jwtProvider.parse(token);
        } catch (ExpiredJwtException e) {
            throw new BusinessException(ErrorCode.EXPIRED_TOKEN);
        } catch (JwtException | IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.MALFORMED_TOKEN);
        }
        if (!"refresh".equals(claims.get("type", String.class))) {
            throw new BusinessException(ErrorCode.INVALID_TOKEN_TYPE);
        }
        return claims;
    }
}
