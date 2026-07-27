package com.back.domain.chat.repository;

import com.back.domain.chat.entity.ChatParticipant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

    Optional<ChatParticipant> findByRoomIdAndMemberId(Long roomId, Long memberId);

    boolean existsByRoomIdAndMemberIdAndLeftAtIsNull(Long roomId, Long memberId);

    List<ChatParticipant> findByRoomIdAndLeftAtIsNull(Long roomId);

    List<ChatParticipant> findByRoomIdInAndLeftAtIsNull(List<Long> roomIds);
}
