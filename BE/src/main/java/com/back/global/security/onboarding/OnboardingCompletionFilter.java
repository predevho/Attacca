package com.back.global.security.onboarding;

import com.back.domain.member.repository.MemberRepository;
import com.back.global.common.ApiResponse;
import com.back.global.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 카카오 신규 가입자는 닉네임과 필수 동의를 확정하기 전까지 가입 완료 API만 사용할 수 있다.
 *
 * <p>JWT에는 가입 진행 상태를 넣지 않는다. 완료 직후에도 기존 access 토큰으로 즉시 일반 기능을
 * 쓸 수 있어야 하므로, 요청 시 회원의 현재 상태를 확인한다.
 */
@Component
@RequiredArgsConstructor
public class OnboardingCompletionFilter extends OncePerRequestFilter {

    private final MemberRepository memberRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean onboardingTicket = authentication != null
                && "onboarding".equals(authentication.getDetails());
        boolean incompleteMember = authentication != null
                && authentication.getPrincipal() instanceof Long memberId
                && memberRepository.findById(memberId)
                .map(member -> !member.isOnboardingComplete())
                .orElse(false);
        if ((onboardingTicket || incompleteMember) && !isOnboardingRequest(request)) {
            response.setStatus(ErrorCode.FORBIDDEN.getStatus().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), ApiResponse.error(ErrorCode.FORBIDDEN,
                    "닉네임과 필수 약관 동의를 완료해 주세요."));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isOnboardingRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        return ("/api/members/me".equals(path)
                && ("GET".equals(request.getMethod()) || "PATCH".equals(request.getMethod())))
                || ("/api/members/me/onboarding".equals(path) && "POST".equals(request.getMethod()));
    }
}
