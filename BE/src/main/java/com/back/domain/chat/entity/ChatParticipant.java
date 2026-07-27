package com.back.domain.chat.entity;

import com.back.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 방 참여자. 퇴장은 삭제가 아니라 leftAt 마킹(soft leave). (roomId, memberId) 유일. */
@Entity
@Table(name = "chat_participant",
        uniqueConstraints = @UniqueConstraint(columnNames = {"roomId", "memberId"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatParticipant extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long roomId;

    @Column(nullable = false)
    private Long memberId;

    /** null 이면 활성 참여, 값이 있으면 퇴장. */
    private LocalDateTime leftAt;

    /** 읽음 커서. 이 값 이후 상대 메시지 수 = 안 읽은 수. null 이면 아무것도 안 읽음. */
    private Long lastReadMessageId;

    private ChatParticipant(Long roomId, Long memberId) {
        this.roomId = roomId;
        this.memberId = memberId;
    }

    public static ChatParticipant join(Long roomId, Long memberId) {
        return new ChatParticipant(roomId, memberId);
    }

    public void leave() {
        this.leftAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.leftAt = null;
    }

    /** 더 큰 messageId 로만 전진(뒤로 되돌리지 않음). */
    public void updateLastRead(Long messageId) {
        if (messageId == null) {
            return;
        }
        if (this.lastReadMessageId == null || messageId > this.lastReadMessageId) {
            this.lastReadMessageId = messageId;
        }
    }

    public boolean isActive() {
        return leftAt == null;
    }
}
