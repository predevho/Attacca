package com.back.domain.member.service;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.verifiedperformer.service.VerifiedPerformerService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다른 도메인이 작성자/회원 표시정보를 조회할 때 쓰는 협력 서비스.
 * id 묶음을 한 번에 조회(N+1 방지)하고 인증 뱃지를 함께 파생한다.
 */
@Service
@RequiredArgsConstructor
public class MemberQueryService {

    private final MemberRepository memberRepository;
    private final VerifiedPerformerService verifiedPerformerService;

    /** 검색어 최소 길이. 한 글자로 회원 목록 전체를 훑는 것을 막는다. (STATUTE §3.2.1) */
    private static final int MIN_QUERY_LENGTH = 2;

    /**
     * 닉네임으로 회원을 찾는다. CHAT이 1:1 대화 상대를 고를 때 쓴다.
     *
     * <p>짧거나 빈 검색어는 예외가 아니라 **빈 목록**이다 — 타이핑 중인 것이 정상 상태라
     * 400을 던지면 화면이 매 글자마다 에러를 띄우게 된다.
     */
    @Transactional(readOnly = true)
    public List<MemberDisplay> searchDisplaysByNickname(String query, Long excludeMemberId, int size) {
        String q = query == null ? "" : query.trim();
        if (q.length() < MIN_QUERY_LENGTH) {
            return List.of();
        }
        List<Member> found = memberRepository.searchByNickname(q, excludeMemberId,
                PageRequest.of(0, size));
        Set<Long> verifiedIds = verifiedPerformerService.findVerifiedMemberIds(
                found.stream().map(Member::getId).collect(Collectors.toSet()));
        return found.stream()
                .map(m -> new MemberDisplay(m.getId(), m.getNickname(), verifiedIds.contains(m.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<Long, MemberDisplay> findDisplaysByIds(Set<Long> memberIds) {
        if (memberIds == null || memberIds.isEmpty()) {
            return Map.of();
        }
        Set<Long> verifiedIds = verifiedPerformerService.findVerifiedMemberIds(memberIds);
        return memberRepository.findAllById(memberIds).stream()
                .collect(Collectors.toMap(Member::getId, member -> new MemberDisplay(
                        member.getId(), member.getNickname(), verifiedIds.contains(member.getId())),
                        (a, b) -> a));
    }
}
