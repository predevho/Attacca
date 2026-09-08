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
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜(OAuth2) 로그인. provider 인가코드를 검증(OAuthClient)해 얻은 유저정보로
 * 기존 로그인 / 이메일 자동연결 / 신규 자동가입을 수행하고 우리 JWT 를 발급한다.
 */
@Service
public class MemberOAuthService {

    private final MemberRepository memberRepository;
    private final SocialAccountRepository socialAccountRepository;
    private final TokenIssuer tokenIssuer;
    private final List<OAuthClient> oauthClients;
    private final MemberConsentService consentService;

    public MemberOAuthService(MemberRepository memberRepository,
                              SocialAccountRepository socialAccountRepository,
                              TokenIssuer tokenIssuer,
                              List<OAuthClient> oauthClients,
                              MemberConsentService consentService) {
        this.memberRepository = memberRepository;
        this.socialAccountRepository = socialAccountRepository;
        this.tokenIssuer = tokenIssuer;
        this.oauthClients = oauthClients;
        this.consentService = consentService;
    }

    @Transactional
    public TokenPairResponse oauthLogin(OAuthProvider provider, String code, String redirectUri,
            boolean agreedTerms, boolean agreedPrivacy) {
        OAuthUserInfo info = resolveClient(provider).fetch(code, redirectUri);

        Member member = socialAccountRepository
                .findByProviderAndProviderUserId(provider, info.providerUserId())
                .map(SocialAccount::getMember)
                .orElseGet(() -> linkOrCreate(provider, info, agreedTerms, agreedPrivacy));

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
    private Member linkOrCreate(OAuthProvider provider, OAuthUserInfo info,
            boolean agreedTerms, boolean agreedPrivacy) {
        if (!info.emailVerified() || info.email() == null || info.email().isBlank()) {
            throw new BusinessException(ErrorCode.OAUTH_EMAIL_UNVERIFIED);
        }

        // 이미 있는 회원에 소셜 계정을 붙이는 것은 '가입'이 아니므로 동의를 다시 묻지 않는다.
        // 새로 만드는 경우에만 요구한다(DOMAIN-MEMBER-STATUTE §3.4).
        Member member = memberRepository.findByEmail(info.email())
                .orElseGet(() -> {
                    consentService.requireAgreed(agreedTerms, agreedPrivacy);
                    Member created = memberRepository.save(
                            Member.createSocial(info.email(), uniqueNickname(info.nickname())));
                    consentService.recordRequired(created.getId());
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
