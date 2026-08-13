package com.nexuspm.shared.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    private Cache cache = new Cache();
    private Ai ai = new Ai();
    private Jira jira = new Jira();

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

    @Getter
    @Setter
    public static class Cache {
        /** Master switch for Spring Cache / Caffeine. */
        private boolean enabled = true;
        /** Default TTL for all named caches (safety net even with write eviction). */
        private long ttlMinutes = 360;
        /** Max entries per cache. */
        private long maxSize = 500;
        /** Warm caches after application start. */
        private boolean warmupOnStartup = true;
        /** Cron for daily full refresh (default 02:00 server time). */
        private String dailyRefreshCron = "0 0 2 * * *";
    }

    /**
     * OpenAI-compatible Assistant (Ollama, OpenAI, Azure gateway, etc.).
     * Spring AI 1.0 requires Boot 3.4+; Phase 1–2 use RestClient against the same API shape.
     * YAML {@code enabled} is the hard kill switch. Soft toggles live in system_settings.
     */
    @Getter
    @Setter
    public static class Ai {
        private boolean enabled = false;
        /** Fallback when no profiles map / selected profile missing. */
        private String apiKey = "";
        private String baseUrl = "http://localhost:11434/v1";
        private String model = "llama3.1";
        private int maxTokens = 2048;
        private int maxToolRounds = 4;
        /** Optional YAML override; Admin system_instructions appends on top. */
        private String systemPrompt = "";
        private int timeoutMs = 120_000;
        /** Default profile key when ai.model_profile setting is empty. */
        private String defaultProfile = "local-ollama";
        /** Named LLM endpoints Admin can select (never stores secrets in DB). */
        private Map<String, AiProfile> profiles = new LinkedHashMap<>();
    }

    @Getter
    @Setter
    public static class AiProfile {
        private String label = "";
        private String apiKey = "";
        private String baseUrl = "";
        private String model = "";
    }

    /**
     * Jira Cloud REST integration (email + API token basic auth).
     * Secrets stay in env / YAML — never store the API token in the database.
     */
    @Getter
    @Setter
    public static class Jira {
        private boolean enabled = false;
        /** e.g. https://your-domain.atlassian.net */
        private String baseUrl = "";
        private String email = "";
        private String apiToken = "";
        private int connectTimeoutMs = 15_000;
        private int readTimeoutMs = 60_000;
        /**
         * Comma-separated Jira issue type names synced into PM as RD items (CHANGE type).
         * Default matches DirectFN Jira work types: Change, New Feature, etc.
         */
        private String crIssueTypeNames = "Change,Change Request,CR,New Feature,Feature,Features";

        public List<String> resolvedCrIssueTypeNames() {
            if (crIssueTypeNames == null || crIssueTypeNames.isBlank()) {
                return List.of("Change", "Change Request", "CR", "New Feature", "Feature", "Features");
            }
            return java.util.Arrays.stream(crIssueTypeNames.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();
        }
    }
}
