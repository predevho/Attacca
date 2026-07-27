package com.back.domain.chat.repository;

import com.back.domain.chat.entity.ChatMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** 방 메시지 이력: cursor 미만을 id 내림차순(최신→과거). cursor=null 이면 최신부터. */
    @Query("select m from ChatMessage m "
            + "where m.roomId = :roomId and (:cursor is null or m.id < :cursor) "
            + "order by m.id desc")
    List<ChatMessage> findHistory(@Param("roomId") Long roomId, @Param("cursor") Long cursor,
            Pageable pageable);

    /** 각 방의 마지막 메시지 1개씩(방 목록 미리보기). 방당 max(id) 를 한 번에. */
    @Query("select m from ChatMessage m where m.id in "
            + "(select max(m2.id) from ChatMessage m2 where m2.roomId in :roomIds group by m2.roomId)")
    List<ChatMessage> findLatestPerRoom(@Param("roomIds") List<Long> roomIds);

    /** 방별 안 읽은 수: 내 읽음커서 이후의 '상대' 메시지 수를 한 번에 집계. */
    @Query("select m.roomId as roomId, count(m) as unreadCount from ChatMessage m "
            + "left join ChatParticipant p on p.roomId = m.roomId and p.memberId = :memberId "
            + "where m.roomId in :roomIds and m.senderId <> :memberId "
            + "  and (p.lastReadMessageId is null or m.id > p.lastReadMessageId) "
            + "group by m.roomId")
    List<RoomUnreadCount> countUnreadPerRoom(@Param("memberId") Long memberId,
            @Param("roomIds") List<Long> roomIds);
}
