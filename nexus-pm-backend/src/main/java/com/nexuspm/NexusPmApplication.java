package com.nexuspm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaAuditing(auditorAwareRef = "securityAuditorAware")
@EnableScheduling
public class NexusPmApplication {

    public static void main(String[] args) {
        SpringApplication.run(NexusPmApplication.class, args);
    }
}
