package com.back.domain.member.repository;

import com.back.domain.member.entity.MemberConsent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberConsentRepository extends JpaRepository<MemberConsent, Long> {

    List<MemberConsent> findByMemberIdOrderByAgreedAtDesc(Long memberId);
}
