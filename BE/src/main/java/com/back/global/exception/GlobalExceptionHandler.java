package com.back.global.exception;

import com.back.global.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 전역 예외 처리기. 모든 예외를 공통 응답 래퍼({@link ApiResponse})로 일괄 변환한다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        ErrorCode errorCode = e.getErrorCode();
        log.warn("BusinessException: code={}, message={}", errorCode.getCode(), e.getMessage());
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode, e.getMessage()));
    }

    // 매칭되는 핸들러가 없는 모든 URL(정적 리소스 포함, 앱 전역)에 대해 Spring이 던지는 예외.
    // catch-all(Exception.class)에 걸려 500으로 뭉개지지 않도록 404로 명시 처리한다.
    // 파일 저장소 관련 예외가 아니므로 FILE_NOT_FOUND가 아닌 일반 RESOURCE_NOT_FOUND를 사용한다.
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(NoResourceFoundException e) {
        ErrorCode errorCode = ErrorCode.RESOURCE_NOT_FOUND;
        log.warn("NoResourceFoundException: path={}", e.getResourcePath());
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode));
    }

    // 경로는 맞지만 메서드가 다른 요청(예: 조회 전용 경로에 POST).
    // ErrorCode에 405-01이 정의돼 있었는데 이를 쓰는 핸들러가 없어 catch-all로 떨어져 500으로 응답되고 있었다.
    // NoResourceFoundException(404), 파라미터 바인딩 실패(400)와 같은 계열의 결함이다.
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException e) {
        ErrorCode errorCode = ErrorCode.METHOD_NOT_ALLOWED;
        log.warn("HttpRequestMethodNotSupportedException: method={}", e.getMethod());
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode));
    }

    // @Valid 검증 실패. 첫 필드 오류를 메시지로 노출한다.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
        ErrorCode errorCode = ErrorCode.INVALID_INPUT_VALUE;
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse(errorCode.getMessage());
        log.warn("MethodArgumentNotValidException: {}", message);
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode, message));
    }

    // 본문 파싱 실패(JSON 문법 오류, enum에 없는 값 등). 클라이언트 실수이므로 400.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadable(HttpMessageNotReadableException e) {
        ErrorCode errorCode = ErrorCode.INVALID_INPUT_VALUE;
        log.warn("HttpMessageNotReadableException: {}", e.getMessage());
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode));
    }

    // multipart 필수 파트 누락.
    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingServletRequestPart(MissingServletRequestPartException e) {
        ErrorCode errorCode = ErrorCode.INVALID_INPUT_VALUE;
        log.warn("MissingServletRequestPartException: part={}", e.getRequestPartName());
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode));
    }

    // 쿼리/경로 파라미터 바인딩 실패. 타입 변환 실패(enum 상수에 없는 값, 숫자 자리에 문자 등)와
    // 필수 파라미터 누락은 모두 클라이언트 입력 오류이므로, catch-all에 걸려 500이 되지 않도록 400으로 명시 처리한다.
    // 본문 파싱 실패(HttpMessageNotReadableException)의 쿼리 파라미터 판이다.
    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiResponse<Void>> handleRequestParameterBindingFailure(Exception e) {
        ErrorCode errorCode = ErrorCode.INVALID_INPUT_VALUE;
        log.warn("요청 파라미터 바인딩 실패: {}", e.getMessage());
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception e) {
        log.error("Unhandled exception", e);
        ErrorCode errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(errorCode.getStatus())
                .body(ApiResponse.error(errorCode));
    }
}
