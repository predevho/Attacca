package com.back.domain.member.service;

import com.back.domain.member.dto.MemberIdentityResponse;
import com.back.domain.member.dto.ProfileImageResponse;
import com.back.domain.member.dto.ProfileResponse;
import com.back.domain.member.dto.UpdateProfileRequest;
import com.back.domain.member.dto.UpdateNicknameRequest;
import com.back.domain.member.entity.Instrument;
import com.back.domain.member.entity.Member;
import com.back.domain.member.entity.MemberProfile;
import com.back.domain.member.repository.MemberProfileRepository;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.verifiedperformer.service.VerifiedPerformerService;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.storage.FileService;
import com.back.global.storage.StoredFile;
import com.back.global.security.token.TokenIssuer;
import com.back.domain.member.dto.TokenPairResponse;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 회원 프로필 서비스. 프로필은 가입 시 만들지 않고 첫 수정/업로드 때 생성한다(lazy upsert).
 * 파일은 FileService만 경유한다(FileStorage 직접 호출 금지).
 */
@Service
public class MemberProfileService {

    private static final String PROFILE_IMAGE_DIRECTORY = "profile";

    private final MemberRepository memberRepository;
    private final MemberProfileRepository memberProfileRepository;
    private final FileService fileService;
    // 인증 뱃지는 이 도메인의 값이 아니라 VERIFIED-PERFORMER 도메인의 파생 정보다.
    // 서비스 계층으로만 협력하고 그 엔티티는 직접 참조하지 않는다(도메인 경계 유지).
    private final VerifiedPerformerService verifiedPerformerService;
    private final MemberConsentService consentService;
    private final TokenIssuer tokenIssuer;

    public MemberProfileService(MemberRepository memberRepository,
            MemberProfileRepository memberProfileRepository, FileService fileService,
            VerifiedPerformerService verifiedPerformerService, MemberConsentService consentService) {
        this(memberRepository, memberProfileRepository, fileService, verifiedPerformerService,
                consentService, null);
    }

    @Autowired
    public MemberProfileService(MemberRepository memberRepository,
            MemberProfileRepository memberProfileRepository, FileService fileService,
            VerifiedPerformerService verifiedPerformerService, MemberConsentService consentService,
            TokenIssuer tokenIssuer) {
        this.memberRepository = memberRepository;
        this.memberProfileRepository = memberProfileRepository;
        this.fileService = fileService;
        this.verifiedPerformerService = verifiedPerformerService;
        this.consentService = consentService;
        this.tokenIssuer = tokenIssuer;
    }

    @Transactional(readOnly = true)
    public MemberIdentityResponse getMyIdentity(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        boolean verified = verifiedPerformerService.isVerified(memberId);
        return new MemberIdentityResponse(
                member.getId(), member.getNickname(), member.getRole(), verified);
    }

    /** 인증 principal의 회원만 대상으로 닉네임을 부분 수정한다. 중복은 기존 회원 에러 코드를 유지한다. */
    @Transactional
    public MemberIdentityResponse updateNickname(Long memberId, UpdateNicknameRequest request) {
        Member member = completeNickname(memberId, request);
        boolean verified = verifiedPerformerService.isVerified(memberId);
        return new MemberIdentityResponse(member.getId(), member.getNickname(), member.getRole(), verified);
    }

    @Transactional
    public TokenPairResponse completeOnboarding(Long memberId, UpdateNicknameRequest request) {
        Member current = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        if (current.isOnboardingComplete()) {
            throw new BusinessException(ErrorCode.INVALID_TOKEN_TYPE, "이미 완료된 온보딩 티켓입니다.");
        }
        Member member = completeNickname(memberId, request);
        TokenIssuer.IssuedTokens tokens = tokenIssuer.issue(member.getId(), member.getRole());
        return new TokenPairResponse(tokens.accessToken(), tokens.refreshToken());
    }

    private Member completeNickname(Long memberId, UpdateNicknameRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        String nickname = request.nickname().trim();
        if (!nickname.equals(member.getNickname()) && memberRepository.existsByNickname(nickname)) {
            throw new BusinessException(ErrorCode.NICKNAME_ALREADY_EXISTS);
        }
        if (!member.isOnboardingComplete()) {
            consentService.requireAgreed(request.agreedTerms(), request.agreedPrivacy());
            consentService.recordRequired(member.getId());
            member.completeOnboarding();
        }
        member.changeNickname(nickname);
        return member;
    }

    @Transactional(readOnly = true)
    public ProfileResponse getMyProfile(Long memberId) {
        boolean verified = verifiedPerformerService.isVerified(memberId);
        return memberProfileRepository.findByMemberId(memberId)
                .map(profile -> toResponse(profile, verified))
                // 프로필이 없어도(악기/소개 미입력) 어드민 직접지정 등으로 인증될 수 있으므로 뱃지는 별도 파생.
                .orElseGet(() -> ProfileResponse.empty(verified));
    }

    @Transactional
    public ProfileResponse updateMyProfile(Long memberId, UpdateProfileRequest request) {
        MemberProfile profile = getOrCreate(memberId);
        Set<Instrument> instruments = request.instruments() == null
                ? Set.of()
                : Set.copyOf(request.instruments());
        profile.updateInfo(instruments, request.bio());
        return toResponse(profile, verifiedPerformerService.isVerified(memberId));
    }

    @Transactional
    public ProfileImageResponse updateProfileImage(Long memberId, MultipartFile file) {
        validateImage(file);
        MemberProfile profile = getOrCreate(memberId);
        String oldKey = profile.getProfileImageKey();

        StoredFile stored = fileService.upload(file, PROFILE_IMAGE_DIRECTORY, memberId);
        profile.changeImage(stored.storageKey());

        // 새 이미지 저장이 확정된 뒤에만 옛 파일을 제거한다 — 실패해도 이미지 유실 없음.
        if (oldKey != null) {
            fileService.delete(oldKey);
        }
        return new ProfileImageResponse(stored.url());
    }

    /** 이미지 타입 정책은 MEMBER 도메인의 책임(DOMAIN-COMMON-STATUTE §7). 크기 상한은 전역 multipart 설정이 담당. */
    private void validateImage(MultipartFile file) {
        if (file == null || file.getContentType() == null
                || !file.getContentType().startsWith("image/")) {
            throw new BusinessException(ErrorCode.INVALID_FILE, "이미지 파일만 업로드할 수 있습니다.");
        }
    }

    private MemberProfile getOrCreate(Long memberId) {
        return memberProfileRepository.findByMemberId(memberId)
                .orElseGet(() -> {
                    Member member = memberRepository.findById(memberId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
                    return memberProfileRepository.save(MemberProfile.create(member));
                });
    }

    private ProfileResponse toResponse(MemberProfile profile, boolean verified) {
        String url = profile.getProfileImageKey() == null
                ? null
                : fileService.getUrl(profile.getProfileImageKey());
        return ProfileResponse.from(profile, url, verified);
    }
}
