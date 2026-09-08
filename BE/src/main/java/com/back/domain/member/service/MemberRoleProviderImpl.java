package com.back.domain.member.service;

import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.MemberRoleProvider;
import com.back.global.security.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link MemberRoleProvider} 구현. 포트는 {@code global.security}에 있고 구현이 여기 있다 —
 * 회원 데이터의 소유는 MEMBER 도메인이고, {@code global}은 도메인을 참조하지 않기 때문이다.
 */
@Service
@RequiredArgsConstructor
public class MemberRoleProviderImpl implements MemberRoleProvider {

    private final MemberRepository memberRepository;

    @Override
    @Transactional(readOnly = true)
    public Role findRole(Long memberId) {
        return memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND))
                .getRole();
    }
}
