package com.back.domain.chat.service;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse.LastMessage;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.dto.InviteRequest;
import com.back.domain.chat.dto.ParticipantView;
import com.back.domain.chat.entity.ChatMessage;
import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.entity.ChatRoom;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.chat.repository.ChatMessageRepository;
import com.back.domain.chat.repository.ChatParticipantRepository;
import com.back.domain.chat.repository.ChatRoomRepository;
import com.back.domain.chat.repository.RoomUnreadCount;
import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.websocket.PresenceRegistry;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 채팅방 생성/상세/초대/퇴장. 참여자 표시정보는 MEMBER 협력으로 파생한다. */
@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final ChatRoomRepository roomRepository;
    private final ChatParticipantRepository participantRepository;
    private final MemberQueryService memberQueryService;
    private final PresenceRegistry presenceRegistry;
    private final DirectRoomInitializer directRoomInitializer;
    private final ChatMessageRepository messageRepository;

    @Transactional
    public ChatRoomResponse createRoom(Long memberId, CreateRoomRequest request) {
        ChatRoom room = request.type() == RoomType.DIRECT
                ? createDirect(memberId, request.participantIdsOrEmpty())
                : createGroup(memberId, request);
        return toResponse(room);
    }

    private ChatRoom createDirect(Long memberId, List<Long> participantIds) {
        if (participantIds.size() != 1) {
            throw new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS);
        }
        Long other = participantIds.get(0);
        String key = ChatRoom.directKey(memberId, other); // memberId==other 면 아래 createDirect 가 거절
        return roomRepository.findByDirectKey(key).orElseGet(() -> openDirect(memberId, other, key));
    }

    private ChatRoom openDirect(Long memberId, Long other, String key) {
        try {
            return directRoomInitializer.insertDirect(memberId, other);
        } catch (DataIntegrityViolationException e) {
            // 동시 생성 경합: unique 위반이면 이미 만들어진 방을 재사용(멱등).
            // insertDirect 는 REQUIRES_NEW 로 격리되어 있어 이 트랜잭션은 오염되지 않는다.
            // 재조회 실패 = 진짜 DB 오류이므로 원 예외를 그대로 전파(errorCode 로 위장하지 않는다)
            return roomRepository.findByDirectKey(key).orElseThrow(() -> e);
        }
    }

    private ChatRoom createGroup(Long memberId, CreateRoomRequest request) {
        ChatRoom room = roomRepository.save(ChatRoom.createGroup(memberId, request.title()));
        participantRepository.save(ChatParticipant.join(room.getId(), memberId));
        for (Long id : request.participantIdsOrEmpty()) {
            if (!id.equals(memberId)) {
                participantRepository.save(ChatParticipant.join(room.getId(), id));
            }
        }
        return room;
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse getRoom(Long memberId, Long roomId) {
        ChatRoom room = findRoom(roomId);
        assertActiveParticipant(roomId, memberId);
        return toResponse(room);
    }

    @Transactional
    public ChatRoomResponse invite(Long memberId, Long roomId, InviteRequest request) {
        ChatRoom room = findRoom(roomId);
        assertActiveParticipant(roomId, memberId);
        if (room.getType() == RoomType.DIRECT) {
            throw new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS); // 1:1 에 초대 불가
        }
        for (Long invitee : request.memberIds()) {
            participantRepository.findByRoomIdAndMemberId(roomId, invitee).ifPresentOrElse(
                    ChatParticipant::rejoin, // 과거 퇴장자면 재활성(활성이면 no-op 과 동일)
                    () -> participantRepository.save(ChatParticipant.join(roomId, invitee)));
        }
        return toResponse(room);
    }

    @Transactional
    public void leave(Long memberId, Long roomId) {
        findRoom(roomId);
        participantRepository.findByRoomIdAndMemberId(roomId, memberId)
                .filter(ChatParticipant::isActive)
                .ifPresent(ChatParticipant::leave);
    }

    /** 활성 참여자가 아니면 403. WebSocket 인가·다른 서비스에서도 재사용. */
    public void assertActiveParticipant(Long roomId, Long memberId) {
        if (!participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(roomId, memberId)) {
            throw new BusinessException(ErrorCode.NOT_ROOM_PARTICIPANT);
        }
    }

    private ChatRoom findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_ROOM_NOT_FOUND));
    }

    private ChatRoomResponse toResponse(ChatRoom room) {
        List<ChatParticipant> participants = participantRepository
                .findByRoomIdAndLeftAtIsNull(room.getId());
        Set<Long> ids = participants.stream().map(ChatParticipant::getMemberId)
                .collect(Collectors.toSet());
        Map<Long, MemberDisplay> displays = memberQueryService.findDisplaysByIds(ids);
        Set<Long> online = presenceRegistry.onlineAmong(ids);
        List<ParticipantView> views = participants.stream()
                .map(p -> toView(displays.get(p.getMemberId()), p.getMemberId(),
                        online.contains(p.getMemberId())))
                .toList();
        return new ChatRoomResponse(room.getId(), room.getType(), room.getTitle(), views,
                room.getCreatedAt());
    }

    private ParticipantView toView(MemberDisplay d, Long memberId, boolean online) {
        if (d == null) {
            return new ParticipantView(memberId, null, false, online);
        }
        return new ParticipantView(d.memberId(), d.nickname(), d.verified(), online);
    }

    @Transactional(readOnly = true)
    public Page<ChatRoomSummaryResponse> listRooms(Long memberId, Pageable pageable) {
        Page<ChatRoom> rooms = roomRepository.findRoomsForMember(memberId, pageable);
        List<Long> roomIds = rooms.getContent().stream().map(ChatRoom::getId).toList();
        if (roomIds.isEmpty()) {
            return rooms.map(r -> null); // 빈 페이지
        }
        Map<Long, ChatMessage> lastMessages = messageRepository.findLatestPerRoom(roomIds).stream()
                .collect(Collectors.toMap(ChatMessage::getRoomId, m -> m));
        Map<Long, Long> unread = new HashMap<>();
        for (RoomUnreadCount c : messageRepository.countUnreadPerRoom(memberId, roomIds)) {
            unread.put(c.getRoomId(), c.getUnreadCount());
        }
        Map<Long, String> directNames = directDisplayNames(memberId, rooms.getContent());
        return rooms.map(room -> toSummary(room, lastMessages.get(room.getId()),
                unread.getOrDefault(room.getId(), 0L), directNames.get(room.getId())));
    }

    /** DIRECT 방의 표시 이름(상대 닉네임)을 배치로 파생한다. */
    private Map<Long, String> directDisplayNames(Long memberId, List<ChatRoom> rooms) {
        List<Long> directRoomIds = rooms.stream()
                .filter(room -> room.getType() == RoomType.DIRECT)
                .map(ChatRoom::getId)
                .toList();
        if (directRoomIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<ChatParticipant>> byRoom = participantRepository
                .findByRoomIdInAndLeftAtIsNull(directRoomIds).stream()
                .collect(Collectors.groupingBy(ChatParticipant::getRoomId));
        Map<Long, Long> roomToOther = new HashMap<>();
        byRoom.forEach((roomId, participants) -> participants.stream()
                .map(ChatParticipant::getMemberId)
                .filter(id -> !id.equals(memberId))
                .findFirst()
                .ifPresent(other -> roomToOther.put(roomId, other)));
        Map<Long, MemberDisplay> displays = memberQueryService
                .findDisplaysByIds(Set.copyOf(roomToOther.values()));
        Map<Long, String> names = new HashMap<>();
        roomToOther.forEach((roomId, other) -> {
            MemberDisplay d = displays.get(other);
            names.put(roomId, d == null ? null : d.nickname());
        });
        return names;
    }

    private ChatRoomSummaryResponse toSummary(ChatRoom room, ChatMessage last, long unreadCount,
            String directName) {
        String displayName = room.getType() == RoomType.DIRECT ? directName : room.getTitle();
        LastMessage lastMessage = last == null ? null
                : new LastMessage(last.getContent(), last.getSenderId(), last.getCreatedAt());
        return new ChatRoomSummaryResponse(room.getId(), room.getType(), displayName, lastMessage,
                unreadCount, room.getLastMessageAt());
    }

    @Transactional
    public void markRead(Long memberId, Long roomId, Long lastReadMessageId) {
        findRoom(roomId);
        ChatParticipant participant = participantRepository
                .findByRoomIdAndMemberId(roomId, memberId)
                .filter(ChatParticipant::isActive)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_ROOM_PARTICIPANT));
        participant.updateLastRead(lastReadMessageId);
    }
}
