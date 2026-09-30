package com.back.global.security.auth.controller;

import com.back.global.common.ApiResponse;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.MemberRoleProvider;
import com.back.global.security.auth.dto.request.ReissueRequest;
import com.back.global.security.auth.dto.response.TokenResponse;
import com.back.global.security.session.RefreshSessionStore;
import com.back.global.security.token.TokenIssuer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서버 refresh 세션의 재발급·로그아웃. access는 여전히 무상태다.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final TokenIssuer tokenIssuer;
    private final RefreshSessionStore refreshSessionStore;
    private final MemberRoleProvider memberRoleProvider;

    @PostMapping("/reissue")
    public ApiResponse<TokenResponse> reissue(@RequestBody ReissueRequest request) {
        Long memberId = refreshSessionStore.findMemberId(request.refreshSession())
                .orElseThrow(() -> new BusinessException(ErrorCode.REVOKED_TOKEN));
        return ApiResponse.success(new TokenResponse(
                tokenIssuer.issueAccessToken(memberId, memberRoleProvider.findRole(memberId))));
    }

    /** 존재하지 않는 세션도 성공으로 처리해 로그아웃을 멱등으로 유지한다. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody ReissueRequest request) {
        refreshSessionStore.revoke(request.refreshSession());
        return ApiResponse.success();
    }
}
