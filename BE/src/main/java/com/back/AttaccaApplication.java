package com.back;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AttaccaApplication {

    public static void main(String[] args) {
        SpringApplication.run(AttaccaApplication.class, args);
    }

}
