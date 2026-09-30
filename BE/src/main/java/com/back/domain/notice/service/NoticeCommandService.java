package com.back.domain.notice.service;

import com.back.domain.notice.dto.request.NoticeRequest;
import com.back.domain.notice.dto.response.NoticeResponse;
import com.back.domain.notice.entity.Notice;
import com.back.domain.notice.entity.NoticeType;
import com.back.domain.notice.repository.NoticeRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.storage.FileService;
import com.back.global.storage.StoredFile;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** 공지의 등록·수정·삭제와 커버 파일 수명주기를 담당한다. */
@Service
@RequiredArgsConstructor
public class NoticeCommandService {

    private static final String COVER_DIRECTORY = "notice";
    private static final Pattern HTTP_URL = Pattern.compile("^https?://\\S+$", Pattern.CASE_INSENSITIVE);

    private final NoticeRepository noticeRepository;
    private final NoticeResponseAssembler responseAssembler;
    private final FileService fileService;

    @Transactional
    public NoticeResponse register(Long authorId, NoticeRequest request) {
        return create(authorId, request);
    }

    @Transactional
    public NoticeResponse create(long authorId, NoticeRequest request) {
        validateSchedule(request);
        validateSource(request);
        Notice saved = noticeRepository.save(Notice.create(authorId, request.type(), request.title(),
                request.content(), request.scheduledAt(), request.place(), request.pinned(),
                request.sourceName(), request.sourceUrl()));
        return responseAssembler.toAdminResponse(saved);
    }

    @Transactional
    public NoticeResponse editNotice(Long id, NoticeRequest request) {
        validateSchedule(request);
        validateSource(request);
        Notice notice = findActive(id);
        notice.edit(request.type(), request.title(), request.content(), request.scheduledAt(),
                request.place(), request.pinned(), request.sourceName(), request.sourceUrl());
        return responseAssembler.toAdminResponse(notice);
    }

    @Transactional
    public void deleteNotice(Long id) {
        findActive(id).delete();
    }

    @Transactional
    public NoticeResponse updateCover(Long adminId, Long id, MultipartFile file) {
        validateImage(file);
        Notice notice = findActive(id);
        replaceCover(notice, fileService.upload(file, COVER_DIRECTORY, adminId));
        return responseAssembler.toAdminResponse(notice);
    }

    @Transactional
    public NoticeResponse updateCoverBytes(long adminId, long id, byte[] content, String contentType,
            String originalName) {
        Notice notice = findActive(id);
        replaceCover(notice, fileService.upload(content, contentType, originalName, COVER_DIRECTORY, adminId));
        return responseAssembler.toAdminResponse(notice);
    }

    private void replaceCover(Notice notice, StoredFile stored) {
        String oldKey = notice.getCoverImageKey();
        notice.changeCover(stored.storageKey());
        // 새 파일 저장이 끝난 뒤에만 이전 파일을 제거해 이미지 유실을 막는다.
        if (oldKey != null) {
            fileService.delete(oldKey);
        }
    }

    private void validateSchedule(NoticeRequest request) {
        if (request.type() == NoticeType.EVENT && request.scheduledAt() == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "일정에는 날짜가 필요합니다.");
        }
    }

    private void validateSource(NoticeRequest request) {
        String sourceUrl = request.sourceUrl();
        if (sourceUrl == null || sourceUrl.isEmpty()) {
            return;
        }
        if (request.sourceName() == null || request.sourceName().isBlank()
                || !sourceUrl.equals(sourceUrl.trim()) || !HTTP_URL.matcher(sourceUrl).matches()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE,
                    "원문 링크에는 유효한 출처 이름과 http 또는 https URL이 필요합니다.");
        }
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.getContentType() == null || !file.getContentType().startsWith("image/")) {
            throw new BusinessException(ErrorCode.INVALID_FILE, "이미지 파일만 업로드할 수 있습니다.");
        }
    }

    private Notice findActive(Long id) {
        return noticeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOTICE_NOT_FOUND));
    }
}
