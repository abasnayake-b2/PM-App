package com.nexuspm.ai;

import com.nexuspm.ai.dto.AiChatRequest;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatService aiChatService;
    private final AiSettingsService aiSettingsService;
    private final DfnPmProperties properties;
    private final ExecutorService aiExecutor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "ai-chat");
        t.setDaemon(true);
        return t;
    });

    @GetMapping("/status")
    @PreAuthorize("@perm.can('AI_ASSISTANT_VIEW')")
    public Map<String, Object> status() {
        var endpoint = aiSettingsService.resolveEndpoint();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", aiSettingsService.isAssistantAvailable());
        body.put("available", aiSettingsService.isAssistantAvailable());
        body.put("yamlEnabled", aiSettingsService.isHardEnabled());
        body.put("softEnabled", aiSettingsService.isSoftEnabled());
        body.put("model", aiSettingsService.isAssistantAvailable() ? endpoint.model() : "");
        body.put("modelProfile", endpoint.key());
        return body;
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("@perm.can('AI_ASSISTANT_VIEW')")
    public SseEmitter chat(@Valid @RequestBody AiChatRequest request, HttpServletRequest httpRequest) {
        if (!aiSettingsService.isAssistantAvailable()) {
            throw new BusinessException("AI_DISABLED", "Assistant is unavailable (disabled).", 503);
        }

        long timeout = Math.max(60_000L, properties.getAi().getTimeoutMs() + 30_000L);
        SseEmitter emitter = new SseEmitter(timeout);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String ip = clientIp(httpRequest);
        String message = request.getMessage();

        aiExecutor.execute(() -> {
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            try {
                aiChatService.streamChat(message, ip, emitter);
            } catch (BusinessException e) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(Map.of("type", "error", "message", e.getMessage(), "code", e.getErrorCode())));
                    emitter.send(SseEmitter.event().name("done").data(Map.of("type", "done", "ok", false)));
                    emitter.complete();
                } catch (Exception ignored) {
                    emitter.completeWithError(e);
                }
            } catch (Exception e) {
                emitter.completeWithError(e);
            } finally {
                SecurityContextHolder.clearContext();
            }
        });

        return emitter;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
