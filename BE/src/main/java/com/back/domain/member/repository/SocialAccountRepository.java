package com.back.domain.member.repository;

import com.back.domain.member.entity.OAuthProvider;
import com.back.domain.member.entity.SocialAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {

    Optional<SocialAccount> findByProviderAndProviderUserId(OAuthProvider provider, String providerUserId);

    /** 탈퇴 시 소셜 연결을 끊는다. 남겨 두면 카카오 재로그인으로 되살아난다. */
    void deleteByMemberId(Long memberId);
}
