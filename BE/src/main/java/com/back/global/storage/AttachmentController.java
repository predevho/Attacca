package com.back.global.storage;

import com.back.global.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** 피드·구인 작성에 공통으로 쓰는 임시 첨부 업로드 API다. */
@RestController
@RequestMapping("/api/files/attachments")
@RequiredArgsConstructor
public class AttachmentController {

    private final FileService fileService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AttachmentUploadResponse> uploadTemporary(
            @AuthenticationPrincipal Long memberId, @RequestPart("file") MultipartFile file) {
        StoredFile stored = fileService.uploadTemporary(file, memberId);
        return ApiResponse.success(new AttachmentUploadResponse(stored.id(), stored.url()));
    }

    public record AttachmentUploadResponse(Long attachmentId, String url) {
    }
}
