package com.nexuspm.ai;

import com.nexuspm.admin.entity.SystemSetting;
import com.nexuspm.admin.repository.SystemSettingRepository;
import com.nexuspm.ai.dto.AiProfileResponse;
import com.nexuspm.ai.dto.AiSettingsResponse;
import com.nexuspm.ai.dto.UpdateAiSettingsRequest;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.cache.CacheNames;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiSettingsService {

    public static final String KEY_ENABLED = "ai.enabled";
    public static final String KEY_SYSTEM_INSTRUCTIONS = "ai.system_instructions";
    public static final String KEY_MAX_TOOLS = "ai.max_tools_per_question";
    public static final String KEY_RATE_LIMIT = "ai.rate_limit_per_hour";
    public static final String KEY_MODEL_PROFILE = "ai.model_profile";
    public static final String KEY_ALLOWED_ROLES = "ai.allowed_roles";

    private final DfnPmProperties properties;
    private final SystemSettingRepository systemSettingRepository;
    private final AuditLogService auditLogService;

    public boolean isHardEnabled() {
        return properties.getAi().isEnabled();
    }

    public boolean isSoftEnabled() {
        return parseBoolean(getValue(KEY_ENABLED), true);
    }

    public boolean isAssistantAvailable() {
        return isHardEnabled() && isSoftEnabled();
    }

    public int maxToolsPerQuestion() {
        int fromSettings = parseInt(getValue(KEY_MAX_TOOLS), properties.getAi().getMaxToolRounds());
        return Math.max(1, Math.min(20, fromSettings));
    }

    public int rateLimitPerHour() {
        return Math.max(0, parseInt(getValue(KEY_RATE_LIMIT), 30));
    }

    public String systemInstructions() {
        return Optional.ofNullable(getValue(KEY_SYSTEM_INSTRUCTIONS)).orElse("").trim();
    }

    public String modelProfileKey() {
        String fromSettings = getValue(KEY_MODEL_PROFILE);
        if (fromSettings != null && !fromSettings.isBlank()) {
            return fromSettings.trim();
        }
        String def = properties.getAi().getDefaultProfile();
        return def != null && !def.isBlank() ? def : "local-ollama";
    }

    public Set<String> allowedRoles() {
        String raw = getValue(KEY_ALLOWED_ROLES);
        if (raw == null || raw.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    public void assertRoleAllowed(String roleCode) {
        Set<String> allowed = allowedRoles();
        if (allowed.isEmpty()) {
            return;
        }
        String role = roleCode != null ? roleCode.toUpperCase(Locale.ROOT) : "";
        if (!allowed.contains(role)) {
            throw new BusinessException(
                    "AI_ROLE_DENIED",
                    "Assistant is not enabled for your role.",
                    403);
        }
    }

    /**
     * Resolve LLM endpoint from Admin-selected profile, falling back to flat YAML ai.* fields.
     */
    public ResolvedEndpoint resolveEndpoint() {
        DfnPmProperties.Ai ai = properties.getAi();
        String profileKey = modelProfileKey();
        Map<String, DfnPmProperties.AiProfile> profiles = ai.getProfiles();
        if (profiles != null && profiles.containsKey(profileKey)) {
            DfnPmProperties.AiProfile p = profiles.get(profileKey);
            return new ResolvedEndpoint(
                    profileKey,
                    blankTo(p.getLabel(), profileKey),
                    blankTo(p.getBaseUrl(), ai.getBaseUrl()),
                    blankTo(p.getModel(), ai.getModel()),
                    blankTo(p.getApiKey(), ai.getApiKey()),
                    ai.getMaxTokens(),
                    ai.getTimeoutMs());
        }
        return new ResolvedEndpoint(
                profileKey,
                "Default",
                ai.getBaseUrl(),
                ai.getModel(),
                ai.getApiKey(),
                ai.getMaxTokens(),
                ai.getTimeoutMs());
    }

    @Transactional(readOnly = true)
    public AiSettingsResponse getSettings() {
        ResolvedEndpoint endpoint = resolveEndpoint();
        return AiSettingsResponse.builder()
                .yamlEnabled(isHardEnabled())
                .softEnabled(isSoftEnabled())
                .available(isAssistantAvailable())
                .modelProfile(modelProfileKey())
                .systemInstructions(systemInstructions())
                .maxToolsPerQuestion(maxToolsPerQuestion())
                .rateLimitPerHour(rateLimitPerHour())
                .allowedRoles(Optional.ofNullable(getValue(KEY_ALLOWED_ROLES)).orElse(""))
                .profiles(listProfiles())
                .activeProfile(toProfileResponse(endpoint.key(), endpoint))
                .build();
    }

    @Transactional
    @CacheEvict(cacheNames = CacheNames.SETTINGS, allEntries = true)
    public AiSettingsResponse updateSettings(UpdateAiSettingsRequest request) {
        UUID userId = SecurityUtils.currentUserId();
        if (request.getSoftEnabled() != null) {
            upsert(KEY_ENABLED, request.getSoftEnabled() ? "true" : "false", userId);
        }
        if (request.getModelProfile() != null) {
            String key = request.getModelProfile().trim();
            Map<String, DfnPmProperties.AiProfile> profiles = properties.getAi().getProfiles();
            if (profiles != null && !profiles.isEmpty() && !profiles.containsKey(key)) {
                throw new BusinessException("AI_UNKNOWN_PROFILE", "Unknown LLM profile: " + key, 400);
            }
            upsert(KEY_MODEL_PROFILE, key, userId);
        }
        if (request.getSystemInstructions() != null) {
            upsert(KEY_SYSTEM_INSTRUCTIONS, request.getSystemInstructions(), userId);
        }
        if (request.getMaxToolsPerQuestion() != null) {
            upsert(KEY_MAX_TOOLS, String.valueOf(request.getMaxToolsPerQuestion()), userId);
        }
        if (request.getRateLimitPerHour() != null) {
            upsert(KEY_RATE_LIMIT, String.valueOf(request.getRateLimitPerHour()), userId);
        }
        if (request.getAllowedRoles() != null) {
            upsert(KEY_ALLOWED_ROLES, request.getAllowedRoles().trim(), userId);
        }
        auditLogService.log(userId, "UPDATE", "AI_SETTINGS", null, "ai.* settings", null);
        return getSettings();
    }

    public List<AiProfileResponse> listProfiles() {
        Map<String, DfnPmProperties.AiProfile> profiles = properties.getAi().getProfiles();
        List<AiProfileResponse> out = new ArrayList<>();
        if (profiles == null || profiles.isEmpty()) {
            ResolvedEndpoint fallback = resolveEndpoint();
            out.add(toProfileResponse("default", fallback));
            return out;
        }
        for (Map.Entry<String, DfnPmProperties.AiProfile> e : profiles.entrySet()) {
            DfnPmProperties.AiProfile p = e.getValue();
            out.add(AiProfileResponse.builder()
                    .key(e.getKey())
                    .label(blankTo(p.getLabel(), e.getKey()))
                    .model(blankTo(p.getModel(), properties.getAi().getModel()))
                    .baseUrlHost(hostOf(blankTo(p.getBaseUrl(), properties.getAi().getBaseUrl())))
                    .build());
        }
        return out;
    }

    private void upsert(String key, String value, UUID userId) {
        SystemSetting setting = systemSettingRepository.findBySettingKey(key).orElseGet(() -> {
            SystemSetting created = new SystemSetting();
            created.setId(UUID.randomUUID());
            created.setSettingKey(key);
            return created;
        });
        setting.setSettingValue(value);
        setting.setUpdatedBy(userId);
        systemSettingRepository.save(setting);
    }

    private String getValue(String key) {
        return systemSettingRepository.findBySettingKey(key)
                .map(SystemSetting::getSettingValue)
                .orElse(null);
    }

    private AiProfileResponse toProfileResponse(String key, ResolvedEndpoint endpoint) {
        return AiProfileResponse.builder()
                .key(key)
                .label(endpoint.label())
                .model(endpoint.model())
                .baseUrlHost(hostOf(endpoint.baseUrl()))
                .build();
    }

    private static String hostOf(String baseUrl) {
        try {
            URI uri = URI.create(baseUrl);
            if (uri.getHost() != null) {
                return uri.getPort() > 0 ? uri.getHost() + ":" + uri.getPort() : uri.getHost();
            }
        } catch (Exception ignored) {
            // fall through
        }
        return baseUrl != null ? baseUrl.replaceFirst("^https?://", "").split("/")[0] : "";
    }

    private static boolean parseBoolean(String raw, boolean defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        return "true".equalsIgnoreCase(raw.trim()) || "1".equals(raw.trim());
    }

    private static int parseInt(String raw, int defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static String blankTo(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    public record ResolvedEndpoint(
            String key,
            String label,
            String baseUrl,
            String model,
            String apiKey,
            int maxTokens,
            int timeoutMs
    ) {
    }
}
