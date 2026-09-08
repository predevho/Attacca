package com.back.domain.member.service;

import com.back.domain.member.entity.ConsentType;
import com.back.domain.member.entity.MemberConsent;
import com.back.domain.member.repository.MemberConsentRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 가입 동의를 확인하고 이력을 남긴다. (DOMAIN-MEMBER-STATUTE §3.4)
 *
 * <p>확인과 기록을 한 곳에 묶어 둔 이유: 둘이 떨어져 있으면 "확인은 했는데 기록은
 * 안 남는" 조합이 생긴다. 그러면 동의를 받은 셈이 되지 않는다.
 */
@Service
@RequiredArgsConstructor
public class MemberConsentService {

    private final MemberConsentRepository consentRepository;

    /** 필수 동의가 모두 참인지 본다. 하나라도 아니면 가입시키지 않는다. */
    public void requireAgreed(boolean agreedTerms, boolean agreedPrivacy) {
        if (!agreedTerms || !agreedPrivacy) {
            throw new BusinessException(ErrorCode.CONSENT_REQUIRED);
        }
    }

    /**
     * 현재 버전으로 필수 동의 이력을 남긴다.
     * 가입과 같은 트랜잭션에서 불러야 한다 — 회원만 생기고 동의가 없는 상태를 만들지 않는다.
     */
    @Transactional
    public void recordRequired(Long memberId) {
        for (ConsentType type : ConsentPolicy.REQUIRED) {
            consentRepository.save(MemberConsent.of(memberId, type, ConsentPolicy.CURRENT_VERSION));
        }
    }
}
