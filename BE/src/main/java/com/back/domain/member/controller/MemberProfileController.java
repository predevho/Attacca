package com.back.domain.member.controller;

import com.back.domain.member.dto.MemberIdentityResponse;
import com.back.domain.member.dto.ProfileImageResponse;
import com.back.domain.member.dto.ProfileOptionsResponse;
import com.back.domain.member.dto.ProfileResponse;
import com.back.domain.member.dto.UpdateProfileRequest;
import com.back.domain.member.service.MemberProfileService;
import com.back.global.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.back.domain.member.dto.ChangePasswordRequest;
import com.back.domain.member.dto.TokenPairResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 회원 프로필 API. 모두 인증 필요(기본 인가 규칙) — principal은 JWT의 회원 id(Long).
 */
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberProfileController {

    private final MemberProfileService memberProfileService;
    private final com.back.domain.member.service.MemberWithdrawService memberWithdrawService;
    private final com.back.domain.member.service.MemberPasswordService memberPasswordService;

    @GetMapping("/me")
    public ApiResponse<MemberIdentityResponse> getMyIdentity(@AuthenticationPrincipal Long memberId) {
        return ApiResponse.success(memberProfileService.getMyIdentity(memberId));
    }

    @GetMapping("/me/profile")
    public ApiResponse<ProfileResponse> getMyProfile(@AuthenticationPrincipal Long memberId) {
        return ApiResponse.success(memberProfileService.getMyProfile(memberId));
    }

    @PutMapping("/me/profile")
    public ApiResponse<ProfileResponse> updateMyProfile(@AuthenticationPrincipal Long memberId,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.success(memberProfileService.updateMyProfile(memberId, request));
    }

    @PutMapping("/me/profile/image")
    public ApiResponse<ProfileImageResponse> updateProfileImage(@AuthenticationPrincipal Long memberId,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.success(memberProfileService.updateProfileImage(memberId, file));
    }

    /**
     * 비밀번호 변경. 성공하면 다른 기기의 refresh 는 모두 끊기고,
     * 부른 본인만 새 토큰 쌍을 받는다. (DOMAIN-MEMBER-STATUTE §3.5)
     */
    @PutMapping("/me/password")
    public ApiResponse<TokenPairResponse> changePassword(@AuthenticationPrincipal Long memberId,
            @Valid @RequestBody ChangePasswordRequest request) {
        return ApiResponse.success(memberPasswordService.change(memberId, request));
    }

    /**
     * 회원 탈퇴. 되돌릴 수 없다. (DOMAIN-MEMBER-STATUTE §3.6)
     *
     * <p>이미 발급된 access 토큰은 만료(30분)까지 살아 있다. 로그아웃과 같은 절충으로,
     * refresh 를 모두 철회해 재발급을 막는 것으로 끊는다.
     */
    @DeleteMapping("/me")
    public ApiResponse<Void> withdraw(@AuthenticationPrincipal Long memberId) {
        memberWithdrawService.withdraw(memberId);
        return ApiResponse.success();
    }

    @GetMapping("/profile-options")
    public ApiResponse<ProfileOptionsResponse> profileOptions() {
        return ApiResponse.success(ProfileOptionsResponse.create());
    }
}
