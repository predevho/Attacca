package com.back.domain.member.service;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberProfileRepository;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.member.repository.SocialAccountRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.token.RefreshTokenStore;
import com.back.global.storage.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원 탈퇴. (DOMAIN-MEMBER-STATUTE §3.5)
 *
 * <p><b>사람은 지우고 글은 남긴다.</b> 작성물까지 지우면 남의 글타래가 무너진다.
 * 작성자 표시는 "탈퇴한 회원"이 된다.
 *
 * <p>동의 이력({@code member_consent})은 남긴다 — 개인 식별 정보가 없고,
 * "동의를 받았는가"에 답하려면 사람이 사라진 뒤에도 필요하다.
 */
@Service
@RequiredArgsConstructor
public class MemberWithdrawService {

    private final MemberRepository memberRepository;
    private final MemberProfileRepository profileRepository;
    private final SocialAccountRepository socialAccountRepository;
    private final RefreshTokenStore refreshTokenStore;
    private final FileService fileService;

    @Transactional
    public void withdraw(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        if (member.isWithdrawn()) {
            throw new BusinessException(ErrorCode.MEMBER_ALREADY_WITHDRAWN);
        }

        // 프로필: 자기소개를 비우고 사진 파일을 실제로 지운다.
        // 파일을 남겨 두면 URL을 아는 사람은 계속 볼 수 있다.
        profileRepository.findByMemberId(memberId).ifPresent(profile -> {
            String key = profile.getProfileImageKey();
            profile.clearForWithdrawal();
            if (key != null) {
                fileService.delete(key);
            }
        });

        // 소셜 연결을 끊는다. 남겨 두면 카카오로 다시 로그인할 때
        // 탈퇴한 회원에 그대로 붙어 되살아난다.
        socialAccountRepository.deleteByMemberId(memberId);

        member.withdraw();

        // 이미 발급된 refresh 를 모두 철회한다. 안 하면 최대 14일간
        // 탈퇴한 계정으로 재발급이 계속된다.
        refreshTokenStore.removeAll(memberId);
    }
}
