package com.back.global.security.token;

import com.back.global.security.Role;
import com.back.global.security.jwt.JwtProvider;
import com.back.global.security.session.RefreshSessionStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 토큰 발급의 단일 지점. 로그인·소셜 로그인·재발급이 모두 여기를 거친다.
 *
 * <p>따로 둔 이유는 <b>"refresh를 발급했는데 화이트리스트에 넣지 않는" 실수를 구조적으로 막기 위해서</b>다.
 * 그런 refresh는 발급 즉시 무효라서(화이트리스트에 없으므로) 사용자가 로그인 직후 튕긴다.
 * 발급과 등록을 한 메서드 안에 묶어 두면 둘이 어긋날 수 없다.
 */
@Component
@RequiredArgsConstructor
public class TokenIssuer {

    private final JwtProvider jwtProvider;
    private final RefreshSessionStore refreshSessionStore;

    /** access JWT와 서버 관리 refresh 세션을 함께 발급한다. */
    public IssuedTokens issue(Long memberId, Role role) {
        String access = jwtProvider.createAccessToken(memberId, role);
        String refreshSession = refreshSessionStore.create(memberId);
        return new IssuedTokens(access, refreshSession);
    }

    public String issueAccessToken(Long memberId, Role role) {
        return jwtProvider.createAccessToken(memberId, role);
    }

    public record IssuedTokens(String accessToken, String refreshSession) {
    }
}
