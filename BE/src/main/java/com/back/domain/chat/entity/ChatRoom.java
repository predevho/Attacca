package com.back.domain.chat.entity;

import com.back.global.common.BaseEntity;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 채팅방. 1:1(DIRECT)과 그룹(GROUP)을 통합한다. 회원은 원시 Long 으로만 참조. */
@Entity
@Table(name = "chat_room")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoom extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RoomType type;

    @Column(length = 100)
    private String title;

    @Column(nullable = false)
    private Long createdBy;

    /** 1:1 중복 방지 키. "min:max". DIRECT 만 값, GROUP 은 null. unique. */
    @Column(unique = true, length = 40)
    private String directKey;

    @Column(nullable = false)
    private LocalDateTime lastMessageAt;

    private ChatRoom(RoomType type, String title, Long createdBy, String directKey) {
        this.type = type;
        this.title = title;
        this.createdBy = createdBy;
        this.directKey = directKey;
        this.lastMessageAt = LocalDateTime.now();
    }

    /** 정렬된 쌍 키. 순서 무관 정규화(unordered pair). */
    public static String directKey(Long a, Long b) {
        long lo = Math.min(a, b);
        long hi = Math.max(a, b);
        return lo + ":" + hi;
    }

    public static ChatRoom createDirect(Long creatorId, Long otherId) {
        if (creatorId == null || otherId == null || creatorId.equals(otherId)) {
            throw new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS);
        }
        return new ChatRoom(RoomType.DIRECT, null, creatorId, directKey(creatorId, otherId));
    }

    public static ChatRoom createGroup(Long creatorId, String title) {
        return new ChatRoom(RoomType.GROUP, title, creatorId, null);
    }

    public void updateLastMessageAt(LocalDateTime at) {
        this.lastMessageAt = at;
    }
}
