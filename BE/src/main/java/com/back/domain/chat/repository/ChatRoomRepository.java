package com.back.domain.chat.repository;

import com.back.domain.chat.entity.ChatRoom;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    Optional<ChatRoom> findByDirectKey(String directKey);

    /** 회원이 활성 참여 중인 방을 마지막 메시지 최신순으로. ChatParticipant 와 entity join(연관 매핑 없음). */
    @Query("select r from ChatRoom r "
            + "where r.id in (select p.roomId from ChatParticipant p "
            + "  where p.memberId = :memberId and p.leftAt is null) "
            + "order by r.lastMessageAt desc, r.id desc")
    Page<ChatRoom> findRoomsForMember(@Param("memberId") Long memberId, Pageable pageable);
}
