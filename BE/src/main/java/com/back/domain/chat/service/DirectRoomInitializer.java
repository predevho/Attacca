package com.back.domain.chat.service;

import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.entity.ChatRoom;
import com.back.domain.chat.repository.ChatParticipantRepository;
import com.back.domain.chat.repository.ChatRoomRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 1:1 방 생성을 별도 트랜잭션(REQUIRES_NEW)으로 격리한다.
 * directKey unique 위반 시 이 트랜잭션만 롤백되고 예외가 호출측으로 전파되어,
 * 바깥 트랜잭션이 rollback-only 로 오염되지 않는다(동시 생성 경합에서 안전한 재조회 가능).
 */
@Service
@RequiredArgsConstructor
public class DirectRoomInitializer {

    private final ChatRoomRepository roomRepository;
    private final ChatParticipantRepository participantRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ChatRoom insertDirect(Long creatorId, Long otherId) {
        ChatRoom room = roomRepository.save(ChatRoom.createDirect(creatorId, otherId));
        participantRepository.save(ChatParticipant.join(room.getId(), creatorId));
        participantRepository.save(ChatParticipant.join(room.getId(), otherId));
        return room;
    }

    /**
     * 경합 복구용 재조회를 새 트랜잭션에서 수행한다.
     * 바깥 트랜잭션(REPEATABLE READ)의 스냅샷은 최초 findByDirectKey 시점에 고정되어 있어
     * 경합 트랜잭션이 커밋한 행이 보이지 않는다. REQUIRES_NEW 로 새 스냅샷을 얻어야
     * 방금 커밋된 방을 조회할 수 있다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public Optional<ChatRoom> findExistingDirect(String directKey) {
        return roomRepository.findByDirectKey(directKey);
    }
}
