package com.back.domain.member.service;

import com.back.domain.member.dto.LoginRequest;
import com.back.domain.member.dto.SignupRequest;
import com.back.domain.member.dto.SignupResponse;
import com.back.domain.member.dto.TokenPairResponse;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.token.TokenIssuer;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 자체(loginId+password) 회원가입·로그인 서비스. 로그인 성공 시 JWT(access+refresh)를 발급한다.
 */
@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenIssuer tokenIssuer;
    private final MemberConsentService consentService;

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        // 중복 검사보다 먼저 본다. 동의하지 않았다면 아이디가 비었는지 따질 이유가 없다.
        consentService.requireAgreed(request.agreedTerms(), request.agreedPrivacy());

        if (memberRepository.existsByLoginId(request.loginId())) {
            throw new BusinessException(ErrorCode.LOGIN_ID_ALREADY_EXISTS);
        }
        if (memberRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        // MySQL 기본 collation은 후행 공백을 무시한다. 다듬지 않고 저장하면
        // "홍길동"과 "홍길동 "이 같은 값으로 비교돼 유니크 제약이 의도와 다르게 걸린다.
        String nickname = request.nickname().trim();
        if (memberRepository.existsByNickname(nickname)) {
            throw new BusinessException(ErrorCode.NICKNAME_ALREADY_EXISTS);
        }

        String encodedPassword = passwordEncoder.encode(request.password());
        Member member = memberRepository.save(
                Member.createLocal(request.loginId(), encodedPassword, request.email(), nickname));
        consentService.recordRequired(member.getId());
        return SignupResponse.from(member);
    }

    /**
     * loginId+password 로그인. 아이디 부재·비밀번호 없음(소셜 전용)·불일치는 모두 LOGIN_FAILED 로 통일.
     */
    @Transactional(readOnly = true)
    public TokenPairResponse login(LoginRequest request) {
        Member member = memberRepository.findByLoginId(request.loginId())
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_FAILED));

        if (member.getPassword() == null
                || !passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }

        // 발급과 화이트리스트 등록을 TokenIssuer가 한 번에 한다(DOMAIN-COMMON-STATUTE §4.1).
        TokenIssuer.IssuedTokens tokens = tokenIssuer.issue(member.getId(), member.getRole());
        return new TokenPairResponse(tokens.accessToken(), tokens.refreshToken());
    }
}
