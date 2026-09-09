package com.back.domain.member.service;

import com.back.domain.member.dto.ChangePasswordRequest;
import com.back.domain.member.dto.TokenPairResponse;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.token.RefreshTokenStore;
import com.back.global.security.token.TokenIssuer;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 비밀번호 변경. (DOMAIN-MEMBER-STATUTE §3.5)
 *
 * <p>바꿀 방법이 없어서, 비밀번호가 새면 <b>탈퇴 말고는 손쓸 방법이 없었다.</b>
 */
@Service
@RequiredArgsConstructor
public class MemberPasswordService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenStore refreshTokenStore;
    private final TokenIssuer tokenIssuer;

    @Transactional
    public TokenPairResponse change(Long memberId, ChangePasswordRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));

        // 소셜 전용 회원은 확인할 현재 값이 없다. 자체 로그인을 새로 여는 것은 다른 기능이다.
        if (member.getPassword() == null) {
            throw new BusinessException(ErrorCode.PASSWORD_NOT_SET);
        }
        // 인증된 요청이어도 현재 비밀번호를 다시 묻는다 — 자리를 비운 사이 남이 쥔
        // 화면으로 비밀번호가 바뀌면 계정을 통째로 빼앗긴다.
        if (!passwordEncoder.matches(request.currentPassword(), member.getPassword())) {
            throw new BusinessException(ErrorCode.CURRENT_PASSWORD_MISMATCH);
        }
        // 바꾼 줄 알았는데 그대로인 상태를 만들지 않는다.
        if (passwordEncoder.matches(request.newPassword(), member.getPassword())) {
            throw new BusinessException(ErrorCode.PASSWORD_UNCHANGED);
        }

        member.changePassword(passwordEncoder.encode(request.newPassword()));

        // 비밀번호를 바꾸는 이유의 절반이 "남이 들어와 있을지 모른다"이므로,
        // 다른 기기를 끊지 않으면 바꾸나 마나다.
        refreshTokenStore.removeAll(memberId);

        // 다만 부른 본인은 계속 쓸 수 있어야 한다. 전부 끊고 끝내면 비밀번호를 바꾼
        // 사람이 자기도 튕겨 나가 다시 로그인해야 한다.
        // (이미 발급된 access(30분)는 만료까지 산다 — 로그아웃·탈퇴와 같은 절충)
        TokenIssuer.IssuedTokens tokens = tokenIssuer.issue(memberId, member.getRole());
        return new TokenPairResponse(tokens.accessToken(), tokens.refreshToken());
    }
}
