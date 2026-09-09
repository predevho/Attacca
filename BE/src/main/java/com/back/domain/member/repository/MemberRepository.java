package com.back.domain.member.repository;

import com.back.domain.member.entity.Member;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemberRepository extends JpaRepository<Member, Long> {

    /**
     * 닉네임 부분 일치 검색(대소문자 무시). 탈퇴 회원과 본인은 빼고 닉네임 오름차순.
     *
     * <p>접두 일치가 아니라 부분 일치인 이유: "정하윤"을 "하윤"으로 찾을 수 있어야 한다.
     * 제외를 서비스가 아니라 쿼리에서 하는 이유: 나중에 걸러내면 size 만큼 채우지 못한다.
     */
    @Query("select m from Member m "
            + "where m.deletedAt is null and m.id <> :excludeId "
            + "and lower(m.nickname) like lower(concat('%', :q, '%')) "
            + "order by m.nickname asc")
    List<Member> searchByNickname(@Param("q") String q, @Param("excludeId") Long excludeId,
            Pageable pageable);

    boolean existsByLoginId(String loginId);

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    Optional<Member> findByLoginId(String loginId);

    Optional<Member> findByEmail(String email);
}
