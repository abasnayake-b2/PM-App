package com.nexuspm.ai.openai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexuspm.ai.AiSettingsService.ResolvedEndpoint;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * OpenAI-compatible chat completions client (OpenAI, Ollama /v1, Azure gateways, etc.).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiCompatibleClient {

    private final DfnPmProperties properties;
    private final ObjectMapper objectMapper;

    public ChatCompletionResponse chat(ChatCompletionRequest request, ResolvedEndpoint endpoint) {
        try {
            return restClient(endpoint).post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(ChatCompletionResponse.class);
        } catch (RestClientException e) {
            log.error("LLM chat completion failed: {}", e.getMessage());
            throw new BusinessException(
                    "AI_PROVIDER_ERROR",
                    "Assistant could not reach the language model. Check AI base-url and that the provider is running.",
                    503);
        }
    }

    private RestClient restClient(ResolvedEndpoint endpoint) {
        String base = endpoint.baseUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        int timeoutMs = endpoint.timeoutMs() > 0 ? endpoint.timeoutMs() : properties.getAi().getTimeoutMs();
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.min(30_000, timeoutMs)))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(base)
                .requestFactory(factory)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE);
        String key = endpoint.apiKey();
        if (key != null && !key.isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + key);
        }
        return builder.build();
    }

    @Getter
    @Setter
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatCompletionRequest {
        private String model;
        private List<ChatMessage> messages;
        private List<Map<String, Object>> tools;
        @JsonProperty("tool_choice")
        private String toolChoice;
        private Integer temperature = 0;
        @JsonProperty("max_tokens")
        private Integer maxTokens;
        private Boolean stream = false;
    }

    @Getter
    @Setter
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatMessage {
        private String role;
        private String content;
        @JsonProperty("tool_calls")
        private List<ToolCall> toolCalls;
        @JsonProperty("tool_call_id")
        private String toolCallId;
        private String name;

        public static ChatMessage system(String content) {
            ChatMessage m = new ChatMessage();
            m.setRole("system");
            m.setContent(content);
            return m;
        }

        public static ChatMessage user(String content) {
            ChatMessage m = new ChatMessage();
            m.setRole("user");
            m.setContent(content);
            return m;
        }

        public static ChatMessage assistantWithTools(String content, List<ToolCall> toolCalls) {
            ChatMessage m = new ChatMessage();
            m.setRole("assistant");
            m.setContent(content);
            m.setToolCalls(toolCalls);
            return m;
        }

        public static ChatMessage toolResult(String toolCallId, String name, String content) {
            ChatMessage m = new ChatMessage();
            m.setRole("tool");
            m.setToolCallId(toolCallId);
            m.setName(name);
            m.setContent(content);
            return m;
        }
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ChatCompletionResponse {
        private List<Choice> choices;

        public ChatMessage firstMessage() {
            if (choices == null || choices.isEmpty() || choices.get(0).getMessage() == null) {
                return null;
            }
            return choices.get(0).getMessage();
        }
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Choice {
        private ChatMessage message;
        @JsonProperty("finish_reason")
        private String finishReason;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ToolCall {
        private String id;
        private String type = "function";
        private FunctionCall function;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FunctionCall {
        private String name;
        private String arguments;
    }

    public String truncateToolPayload(String json, int maxChars) {
        if (json == null) {
            return "{}";
        }
        if (json.length() <= maxChars) {
            return json;
        }
        return json.substring(0, maxChars) + "...[truncated]";
    }

    public List<ToolCall> copyToolCalls(List<ToolCall> source) {
        if (source == null) {
            return List.of();
        }
        List<ToolCall> copy = new ArrayList<>(source.size());
        for (ToolCall tc : source) {
            ToolCall c = new ToolCall();
            c.setId(tc.getId());
            c.setType(tc.getType());
            if (tc.getFunction() != null) {
                FunctionCall fn = new FunctionCall();
                fn.setName(tc.getFunction().getName());
                fn.setArguments(tc.getFunction().getArguments());
                c.setFunction(fn);
            }
            copy.add(c);
        }
        return copy;
    }
}
