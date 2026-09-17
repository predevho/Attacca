package com.back.domain.member.dto;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class SignupRequestValidationTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        validatorFactory.close();
    }

    @Test
    void loginId_rejectsSevenCharacters() {
        assertThat(validator.validate(request("user123", "validpass1"))).isNotEmpty();
    }

    @Test
    void password_rejectsMoreThanTwentyCharacters() {
        assertThat(validator.validate(request("user1234", "valid-password-1234567"))).isNotEmpty();
    }

    private SignupRequest request(String loginId, String password) {
        return new SignupRequest(loginId, password, "test@attacca.com", "테스트", true, true);
    }
}
