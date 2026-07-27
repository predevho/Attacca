package com.back.domain.chat.controller;

import com.back.domain.chat.dto.ChatMessageResponse;
import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.dto.InviteRequest;
import com.back.domain.chat.dto.ReadRequest;
import com.back.domain.chat.service.ChatMessageService;
import com.back.domain.chat.service.ChatRoomService;
import com.back.domain.feed.dto.CursorPage;
import com.back.global.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 채팅 REST API(상태·이력). 실시간 송수신은 STOMP(ChatStompController). 모두 인증 필요. */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatRoomController {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;

    private final ChatRoomService roomService;
    private final ChatMessageService messageService;

    @PostMapping("/rooms")
    public ApiResponse<ChatRoomResponse> create(@AuthenticationPrincipal Long memberId,
            @Valid @RequestBody CreateRoomRequest request) {
        return ApiResponse.success(roomService.createRoom(memberId, request));
    }

    @GetMapping("/rooms")
    public ApiResponse<Page<ChatRoomSummaryResponse>> list(@AuthenticationPrincipal Long memberId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(
                roomService.listRooms(memberId, PageRequest.of(Math.max(page, 0), clamp(size))));
    }

    @GetMapping("/rooms/{id}")
    public ApiResponse<ChatRoomResponse> get(@AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ApiResponse.success(roomService.getRoom(memberId, id));
    }

    @GetMapping("/rooms/{id}/messages")
    public ApiResponse<CursorPage<ChatMessageResponse>> messages(
            @AuthenticationPrincipal Long memberId, @PathVariable Long id,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(messageService.history(memberId, id, cursor, clamp(size)));
    }

    @PostMapping("/rooms/{id}/participants")
    public ApiResponse<ChatRoomResponse> invite(@AuthenticationPrincipal Long memberId,
            @PathVariable Long id, @Valid @RequestBody InviteRequest request) {
        return ApiResponse.success(roomService.invite(memberId, id, request));
    }

    @DeleteMapping("/rooms/{id}/participants/me")
    public ApiResponse<Void> leave(@AuthenticationPrincipal Long memberId, @PathVariable Long id) {
        roomService.leave(memberId, id);
        return ApiResponse.success();
    }

    @PostMapping("/rooms/{id}/read")
    public ApiResponse<Void> read(@AuthenticationPrincipal Long memberId, @PathVariable Long id,
            @Valid @RequestBody ReadRequest request) {
        roomService.markRead(memberId, id, request.lastReadMessageId());
        return ApiResponse.success();
    }

    private int clamp(int size) {
        if (size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }
}
