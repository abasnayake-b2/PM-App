package com.nexuspm.shared.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "dfnpm")
@Getter
@Setter
public class DfnPmProperties {

    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private App app = new App();
    private Security security = new Security();
    private Storage storage = new Storage();

    @Getter
    @Setter
    public static class Jwt {
        private String privateKeyPath;
        private String publicKeyPath;
        private int accessTokenTtlMinutes = 15;
        private int refreshTokenTtlDays = 7;
        /** When true, startup fails if PEM key files are missing (required for production). */
        private boolean requirePersistentKeys = false;
    }

    @Getter
    @Setter
    public static class Security {
        private boolean swaggerEnabled = true;
        private boolean cookieSecure = false;
        private String cookieSameSite = "Lax";
        private boolean redisEnabled = true;
        private boolean rateLimitEnabled = true;
        private long maxUploadBytes = 10L * 1024 * 1024;
        private RateLimit loginRateLimit = new RateLimit(10, 60);
        private RateLimit passwordResetRateLimit = new RateLimit(5, 3600);

        @Getter
        @Setter
        public static class RateLimit {
            private int maxRequests;
            private int windowSeconds;

            public RateLimit() {
            }

            public RateLimit(int maxRequests, int windowSeconds) {
                this.maxRequests = maxRequests;
                this.windowSeconds = windowSeconds;
            }
        }
    }

    @Getter
    @Setter
    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:5173");
    }

    @Getter
    @Setter
    public static class App {
        private String baseUrl = "http://localhost:5173";
        private int passwordResetTtlHours = 1;
        private int passwordMaxAgeDays = 90;
        private int maxFailedLoginAttempts = 5;
    }

    @Getter
    @Setter
    public static class Storage {
        /** Relative directory for employee profile pictures (mirrors logs/ style). */
        private String picDir = "Pic";
        /** Max profile picture size in bytes (default 2 MB). */
        private long maxPicBytes = 2L * 1024 * 1024;
    }
}
