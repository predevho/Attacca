package com.back.domain.member.service;

import com.back.domain.member.dto.TokenPairResponse;
import com.back.domain.member.entity.Member;
import com.back.domain.member.entity.OAuthProvider;
import com.back.domain.member.entity.SocialAccount;
import com.back.domain.member.oauth.OAuthClient;
import com.back.domain.member.oauth.OAuthUserInfo;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.member.repository.SocialAccountRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.token.TokenIssuer;
import com.back.global.security.jwt.JwtProvider;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 소셜(OAuth2) 로그인. provider 인가코드를 검증(OAuthClient)해 얻은 유저정보로
 * 기존 로그인 / 이메일 자동연결 / 신규 소셜 가입 준비를 수행하고 우리 JWT 를 발급한다.
 */
@Service
public class MemberOAuthService {

    private final MemberRepository memberRepository;
    private final SocialAccountRepository socialAccountRepository;
    private final TokenIssuer tokenIssuer;
    private final List<OAuthClient> oauthClients;
    private final JwtProvider jwtProvider;

    public MemberOAuthService(MemberRepository memberRepository,
                              SocialAccountRepository socialAccountRepository,
                              TokenIssuer tokenIssuer,
                              List<OAuthClient> oauthClients) {
        this(memberRepository, socialAccountRepository, tokenIssuer, oauthClients, null);
    }

    @Autowired
    public MemberOAuthService(MemberRepository memberRepository,
                              SocialAccountRepository socialAccountRepository,
                              TokenIssuer tokenIssuer,
                              List<OAuthClient> oauthClients,
                              JwtProvider jwtProvider) {
        this.memberRepository = memberRepository;
        this.socialAccountRepository = socialAccountRepository;
        this.tokenIssuer = tokenIssuer;
        this.oauthClients = oauthClients;
        this.jwtProvider = jwtProvider;
    }

    @Transactional
    public TokenPairResponse oauthLogin(OAuthProvider provider, String code, String redirectUri) {
        OAuthUserInfo info = resolveClient(provider).fetch(code, redirectUri);

        Member existingSocialMember = socialAccountRepository
                .findByProviderAndProviderUserId(provider, info.providerUserId())
                .map(SocialAccount::getMember)
                .orElse(null);
        Member member = existingSocialMember;
        if (member == null) {
            member = linkOrCreate(provider, info);
        }

        if (!member.isOnboardingComplete()) {
            String ticket = jwtProvider.createOnboardingTicket(member.getId(), member.getRole());
            return new TokenPairResponse(null, null, true, ticket);
        }

        TokenIssuer.IssuedTokens tokens = tokenIssuer.issue(member.getId(), member.getRole());
        return new TokenPairResponse(tokens.accessToken(), tokens.refreshToken());
    }

    private OAuthClient resolveClient(OAuthProvider provider) {
        return oauthClients.stream()
                .filter(c -> c.provider() == provider)
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.OAUTH_PROVIDER_ERROR));
    }

    /** SocialAccount 미존재 시: 검증된 이메일로 기존 회원 연결, 없으면 신규 소셜 회원 생성. */
    private Member linkOrCreate(OAuthProvider provider, OAuthUserInfo info) {
        if (!info.emailVerified() || info.email() == null || info.email().isBlank()) {
            throw new BusinessException(ErrorCode.OAUTH_EMAIL_UNVERIFIED);
        }

        // 신규 소셜 회원은 닉네임 설정 화면에서 필수 동의를 남기고 가입을 완료한다.
        Member member = memberRepository.findByEmail(info.email())
                .orElseGet(() -> {
                    Member created = memberRepository.save(
                            Member.createSocial(info.email(), uniqueNickname(info.nickname())));
                    return created;
                });

        socialAccountRepository.save(SocialAccount.create(member, provider, info.providerUserId()));
        return member;
    }

    /** 닉네임 충돌 시 짧은 랜덤 접미사로 유니크 값을 만든다. */
    private String uniqueNickname(String base) {
        String seed = (base == null || base.isBlank()) ? "user" : base;
        String candidate = seed;
        while (memberRepository.existsByNickname(candidate)) {
            candidate = seed + "_" + UUID.randomUUID().toString().substring(0, 4);
        }
        return candidate;
    }
}
