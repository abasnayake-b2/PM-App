package com.nexuspm.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexuspm.ai.dto.AiStructuredAnswer;
import com.nexuspm.ai.openai.OpenAiCompatibleClient;
import com.nexuspm.ai.openai.OpenAiCompatibleClient.ChatCompletionRequest;
import com.nexuspm.ai.openai.OpenAiCompatibleClient.ChatCompletionResponse;
import com.nexuspm.ai.openai.OpenAiCompatibleClient.ChatMessage;
import com.nexuspm.ai.openai.OpenAiCompatibleClient.ToolCall;
import com.nexuspm.ai.tools.ReportTools;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatService {

    private static final int TOOL_PAYLOAD_MAX_CHARS = 24_000;
    private static final int AUDIT_DETAILS_MAX = 1500;
    private static final String DEFAULT_SYSTEM_PROMPT = """
            You are the DFN-PlanX Assistant. You answer questions about reports, capacity, and issue statistics \
            for the logged-in user using only the provided tools.
            Rules:
            - Never invent numbers, names, or statuses. If tools do not return data, say so.
            - Answer in plain language for humans. Prefer short Markdown (bullets, bold names).
            - NEVER paste raw tool JSON, UUIDs lists, or "here is the JSON" dumps into the user-facing answer.
            - Summarise tool results: for over-allocation questions, list people who are over capacity \
            (typically allocatedPct above 100, or clearly overloaded). If none are over-allocated, say so clearly.
            - Respect that data is already scoped to the user's organisation permissions.
            - If a needed tool is unavailable, explain the limitation briefly.
            - Do not claim to change data; you are read-only.
            - Optionally append ONE fenced ```json block with this schema only \
            (title, summary, metrics[{label,value}], tables[{title,columns,rows}], caveats[], sources[{toolKey,label,href}]). \
            Do not put the tool payload itself in that block.
            """;

    private final DfnPmProperties properties;
    private final OpenAiCompatibleClient openAiClient;
    private final ReportTools reportTools;
    private final AuditLogService auditLogService;
    private final AiSettingsService aiSettingsService;
    private final AiRateLimiter aiRateLimiter;
    private final ObjectMapper objectMapper;

    public void streamChat(String userMessage, String clientIp, SseEmitter emitter) {
        if (!aiSettingsService.isAssistantAvailable()) {
            throw new BusinessException("AI_DISABLED", "Assistant is unavailable (disabled).", 503);
        }

        String trimmed = userMessage == null ? "" : userMessage.trim();
        if (trimmed.isEmpty()) {
            throw new BusinessException("AI_EMPTY_MESSAGE", "Message is required.", 400);
        }

        UUID userId = SecurityUtils.currentUserId();
        String role = SecurityUtils.currentUserRole();
        aiSettingsService.assertRoleAllowed(role);
        aiRateLimiter.checkOrThrow(userId, aiSettingsService.rateLimitPerHour());

        long started = System.currentTimeMillis();
        Set<String> toolsUsed = new LinkedHashSet<>();
        boolean success = false;
        String errorCode = null;

        List<ReportTools.ToolSpec> toolSpecs = reportTools.resolveActiveToolsForCurrentUser();
        if (toolSpecs.isEmpty()) {
            sendEvent(emitter, "error", Map.of(
                    "message", "No data sources configured; contact Admin."));
            sendEvent(emitter, "done", Map.of("ok", false));
            emitter.complete();
            audit(userId, clientIp, trimmed, toolsUsed, started, false, "NO_TOOLS");
            return;
        }

        AiSettingsService.ResolvedEndpoint endpoint = aiSettingsService.resolveEndpoint();
        List<Map<String, Object>> openAiTools = reportTools.toOpenAiTools(toolSpecs);
        List<ChatMessage> messages = new ArrayList<>();
        messages.add(ChatMessage.system(buildSystemPrompt(role, toolSpecs)));
        messages.add(ChatMessage.user(trimmed));

        try {
            String finalText = runToolLoop(messages, openAiTools, endpoint, emitter, toolsUsed);
            if (finalText == null || finalText.isBlank()) {
                finalText = "I could not produce an answer from the available report data.";
            }
            AiStructuredAnswer structured = parseStructured(finalText, toolsUsed, toolSpecs);
            String narrative = structured.getSummary() != null && !structured.getSummary().isBlank()
                    ? buildNarrative(structured, finalText)
                    : stripJsonFence(finalText);

            emitTokens(emitter, narrative);
            Map<String, Object> done = new LinkedHashMap<>();
            done.put("ok", true);
            done.put("content", narrative);
            done.put("structured", structured);
            sendEvent(emitter, "done", done);
            emitter.complete();
            success = true;
        } catch (BusinessException e) {
            errorCode = e.getErrorCode();
            sendEvent(emitter, "error", Map.of("message", e.getMessage(), "code", e.getErrorCode()));
            sendEvent(emitter, "done", Map.of("ok", false));
            emitter.complete();
        } catch (Exception e) {
            errorCode = "AI_ERROR";
            log.error("AI chat failed", e);
            sendEvent(emitter, "error", Map.of("message", "Assistant failed to complete this request."));
            sendEvent(emitter, "done", Map.of("ok", false));
            emitter.completeWithError(e);
        } finally {
            audit(userId, clientIp, trimmed, toolsUsed, started, success, errorCode);
        }
    }

    private String runToolLoop(
            List<ChatMessage> messages,
            List<Map<String, Object>> openAiTools,
            AiSettingsService.ResolvedEndpoint endpoint,
            SseEmitter emitter,
            Set<String> toolsUsed) {

        int maxRounds = aiSettingsService.maxToolsPerQuestion();
        int toolsInvoked = 0;
        for (int round = 0; round < maxRounds; round++) {
            ChatCompletionRequest request = new ChatCompletionRequest();
            request.setModel(endpoint.model());
            request.setMessages(messages);
            request.setTools(openAiTools);
            request.setToolChoice("auto");
            request.setMaxTokens(endpoint.maxTokens());
            request.setTemperature(0);
            request.setStream(false);

            ChatCompletionResponse response = openAiClient.chat(request, endpoint);
            ChatMessage assistant = response.firstMessage();
            if (assistant == null) {
                throw new BusinessException("AI_EMPTY_RESPONSE", "Language model returned an empty response.", 502);
            }

            List<ToolCall> toolCalls = assistant.getToolCalls();
            if (toolCalls == null || toolCalls.isEmpty()) {
                return assistant.getContent() != null ? assistant.getContent() : "";
            }

            messages.add(ChatMessage.assistantWithTools(
                    assistant.getContent(),
                    openAiClient.copyToolCalls(toolCalls)));

            for (ToolCall call : toolCalls) {
                if (toolsInvoked >= maxRounds) {
                    break;
                }
                String name = call.getFunction() != null ? call.getFunction().getName() : "unknown";
                String args = call.getFunction() != null ? call.getFunction().getArguments() : "{}";
                String label = reportTools.displayLabel(name);

                sendEvent(emitter, "tool_start", Map.of("toolKey", name, "label", label));
                String resultJson = reportTools.execute(name, args);
                String truncated = openAiClient.truncateToolPayload(resultJson, TOOL_PAYLOAD_MAX_CHARS);
                sendEvent(emitter, "tool_end", Map.of("toolKey", name, "label", label));
                toolsUsed.add(name);
                toolsInvoked++;

                messages.add(ChatMessage.toolResult(call.getId(), name, truncated));
            }
        }

        ChatCompletionRequest finalReq = new ChatCompletionRequest();
        finalReq.setModel(endpoint.model());
        finalReq.setMessages(messages);
        finalReq.setMaxTokens(endpoint.maxTokens());
        finalReq.setTemperature(0);
        finalReq.setStream(false);
        ChatCompletionResponse finalResponse = openAiClient.chat(finalReq, endpoint);
        ChatMessage last = finalResponse.firstMessage();
        return last != null && last.getContent() != null ? last.getContent() : "";
    }

    private String buildSystemPrompt(String role, List<ReportTools.ToolSpec> tools) {
        String yamlOverride = properties.getAi().getSystemPrompt();
        String base = (yamlOverride != null && !yamlOverride.isBlank()) ? yamlOverride : DEFAULT_SYSTEM_PROMPT;
        StringBuilder sb = new StringBuilder(base.trim());
        String adminInstructions = aiSettingsService.systemInstructions();
        if (!adminInstructions.isBlank()) {
            sb.append("\n\nAdditional instructions from Admin:\n").append(adminInstructions);
        }
        sb.append("\n\nUser role code: ").append(role != null ? role : "UNKNOWN");
        sb.append("\nAvailable tools: ");
        for (int i = 0; i < tools.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(tools.get(i).name());
        }
        return sb.toString();
    }

    private AiStructuredAnswer parseStructured(
            String finalText,
            Set<String> toolsUsed,
            List<ReportTools.ToolSpec> toolSpecs) {
        List<AiStructuredAnswer.Source> sources = toolsUsed.stream()
                .map(key -> {
                    String label = toolSpecs.stream()
                            .filter(t -> t.name().equals(key))
                            .map(ReportTools.ToolSpec::displayName)
                            .findFirst()
                            .orElse(reportTools.displayLabel(key));
                    return AiStructuredAnswer.Source.builder()
                            .toolKey(key)
                            .label(label)
                            .href(reportTools.hrefFor(key))
                            .build();
                })
                .toList();

        String json = extractJson(finalText);
        if (json != null) {
            try {
                JsonNode node = objectMapper.readTree(json);
                return AiStructuredAnswer.builder()
                        .title(textOr(node, "title", "Assistant answer"))
                        .summary(textOr(node, "summary", stripJsonFence(finalText)))
                        .metrics(readMetrics(node.path("metrics")))
                        .tables(readTables(node.path("tables")))
                        .caveats(readStringList(node.path("caveats")))
                        .sources(sources.isEmpty() ? readSources(node.path("sources")) : sources)
                        .build();
            } catch (Exception e) {
                log.debug("Could not parse structured AI JSON: {}", e.getMessage());
            }
        }

        return AiStructuredAnswer.builder()
                .title("Assistant answer")
                .summary(stripJsonFence(finalText))
                .metrics(List.of())
                .tables(List.of())
                .caveats(List.of(
                        "Numbers come from live report tools for your account scope.",
                        "If something looks wrong, open the linked Dashboard / Backlog view."))
                .sources(sources)
                .build();
    }

    private static String buildNarrative(AiStructuredAnswer structured, String fallback) {
        if (structured.getSummary() != null && !structured.getSummary().isBlank()) {
            StringBuilder sb = new StringBuilder();
            if (structured.getTitle() != null && !structured.getTitle().isBlank()) {
                sb.append("**").append(structured.getTitle()).append("**\n\n");
            }
            sb.append(structured.getSummary());
            return sb.toString();
        }
        return stripJsonFence(fallback);
    }

    private static String extractJson(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        int fence = trimmed.indexOf("```json");
        if (fence >= 0) {
            int start = trimmed.indexOf('\n', fence);
            int end = trimmed.indexOf("```", start + 1);
            if (start > 0 && end > start) {
                return trimmed.substring(start + 1, end).trim();
            }
        }
        int objStart = trimmed.indexOf('{');
        int objEnd = trimmed.lastIndexOf('}');
        if (objStart >= 0 && objEnd > objStart) {
            return trimmed.substring(objStart, objEnd + 1);
        }
        return null;
    }

    private static String stripJsonFence(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.trim();
        int fence = trimmed.indexOf("```json");
        if (fence >= 0) {
            return trimmed.substring(0, fence).trim();
        }
        return trimmed;
    }

    private List<AiStructuredAnswer.Metric> readMetrics(JsonNode node) {
        List<AiStructuredAnswer.Metric> out = new ArrayList<>();
        if (!node.isArray()) {
            return out;
        }
        for (JsonNode m : node) {
            out.add(AiStructuredAnswer.Metric.builder()
                    .label(m.path("label").asText(""))
                    .value(m.path("value").asText(""))
                    .build());
        }
        return out;
    }

    private List<AiStructuredAnswer.TableBlock> readTables(JsonNode node) {
        List<AiStructuredAnswer.TableBlock> out = new ArrayList<>();
        if (!node.isArray()) {
            return out;
        }
        for (JsonNode t : node) {
            List<String> columns = new ArrayList<>();
            for (JsonNode c : t.path("columns")) {
                columns.add(c.asText());
            }
            List<List<String>> rows = new ArrayList<>();
            for (JsonNode r : t.path("rows")) {
                List<String> row = new ArrayList<>();
                if (r.isArray()) {
                    for (JsonNode cell : r) {
                        row.add(cell.asText());
                    }
                }
                rows.add(row);
            }
            out.add(AiStructuredAnswer.TableBlock.builder()
                    .title(t.path("title").asText(""))
                    .columns(columns)
                    .rows(rows)
                    .build());
        }
        return out;
    }

    private List<String> readStringList(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (!node.isArray()) {
            return out;
        }
        for (JsonNode n : node) {
            out.add(n.asText());
        }
        return out;
    }

    private List<AiStructuredAnswer.Source> readSources(JsonNode node) {
        List<AiStructuredAnswer.Source> out = new ArrayList<>();
        if (!node.isArray()) {
            return out;
        }
        for (JsonNode s : node) {
            out.add(AiStructuredAnswer.Source.builder()
                    .toolKey(s.path("toolKey").asText(""))
                    .label(s.path("label").asText(""))
                    .href(s.path("href").asText("/"))
                    .build());
        }
        return out;
    }

    private static String textOr(JsonNode node, String field, String fallback) {
        String v = node.path(field).asText(null);
        return v != null && !v.isBlank() ? v : fallback;
    }

    private void audit(
            UUID userId,
            String clientIp,
            String question,
            Set<String> toolsUsed,
            long startedMs,
            boolean success,
            String errorCode) {
        try {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("q", truncate(question, 400));
            details.put("tools", toolsUsed);
            details.put("ms", System.currentTimeMillis() - startedMs);
            details.put("ok", success);
            if (errorCode != null) {
                details.put("error", errorCode);
            }
            String json = objectMapper.writeValueAsString(details);
            auditLogService.log(userId, "AI_CHAT", "AI", null, truncate(json, AUDIT_DETAILS_MAX), clientIp);
        } catch (Exception e) {
            log.warn("AI audit failed: {}", e.getMessage());
        }
    }

    private void emitTokens(SseEmitter emitter, String text) {
        int size = 48;
        for (int i = 0; i < text.length(); i += size) {
            String chunk = text.substring(i, Math.min(text.length(), i + size));
            sendEvent(emitter, "token", Map.of("text", chunk));
        }
    }

    private void sendEvent(SseEmitter emitter, String event, Map<String, ?> data) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("type", event);
            payload.putAll(data);
            emitter.send(SseEmitter.event().name(event).data(payload));
        } catch (IOException e) {
            throw new BusinessException("AI_SSE_ERROR", "Failed to stream assistant response.", 500);
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        if (value.length() <= max) {
            return value;
        }
        return value.substring(0, max) + "…";
    }
}
