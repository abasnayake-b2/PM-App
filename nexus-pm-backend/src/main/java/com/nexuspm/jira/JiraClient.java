package com.nexuspm.jira;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Jira Cloud REST client (email + API token basic auth).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JiraClient {

    private static final int PAGE_SIZE = 50;
    private static final int MAX_LOG_BODY_CHARS = 16_000;

    private final DfnPmProperties properties;
    private final ObjectMapper objectMapper;

    public List<JiraIssueSummary> searchCrIssues(String jiraProjectKey, List<String> crIssueTypeNames) {
        String jql = buildCrJql(jiraProjectKey, crIssueTypeNames);
        List<JiraIssueSummary> all = new ArrayList<>();
        String nextPageToken = null;
        String baseUrl = normalizedBaseUrl();

        do {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("jql", jql);
            body.put("maxResults", PAGE_SIZE);
            body.put("fields", List.of("summary", "issuetype", "priority", "description"));
            if (nextPageToken != null && !nextPageToken.isBlank()) {
                body.put("nextPageToken", nextPageToken);
            }

            String path = "/rest/api/3/search/jql";
            log.info("Jira request POST {}{} body={}", baseUrl, path, toLogJson(body));

            SearchResponse response;
            try {
                response = restClient(baseUrl).post()
                        .uri(path)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .exchange((request, clientResponse) -> {
                            String responseBody = clientResponse.bodyTo(String.class);
                            int status = clientResponse.getStatusCode().value();
                            log.info(
                                    "Jira response POST {}{} status={} body={}",
                                    baseUrl,
                                    path,
                                    status,
                                    truncateForLog(responseBody));

                            if (clientResponse.getStatusCode().isError()) {
                                throw new RestClientResponseException(
                                        "Jira returned HTTP " + status,
                                        status,
                                        clientResponse.getStatusCode().toString(),
                                        clientResponse.getHeaders(),
                                        responseBody != null
                                                ? responseBody.getBytes(StandardCharsets.UTF_8)
                                                : null,
                                        StandardCharsets.UTF_8);
                            }

                            if (responseBody == null || responseBody.isBlank()) {
                                return new SearchResponse();
                            }
                            return objectMapper.readValue(responseBody, SearchResponse.class);
                        });
            } catch (RestClientResponseException e) {
                log.error(
                        "Jira search failed status={} body={}",
                        e.getStatusCode().value(),
                        truncateForLog(e.getResponseBodyAsString()));
                throw new BusinessException(
                        "JIRA_ERROR",
                        "Jira search failed (" + e.getStatusCode().value() + "). Check credentials and project key.",
                        502);
            } catch (RestClientException e) {
                log.error("Jira search unreachable: {}", e.getMessage());
                throw new BusinessException(
                        "JIRA_UNAVAILABLE",
                        "Could not reach Jira. Check JIRA_BASE_URL and network access.",
                        503);
            } catch (Exception e) {
                log.error("Jira search response parse failed: {}", e.getMessage());
                throw new BusinessException(
                        "JIRA_ERROR",
                        "Jira response could not be parsed. See server logs for details.",
                        502);
            }

            if (response == null || response.issues == null || response.issues.isEmpty()) {
                log.info("Jira search page empty — stopping pagination (collected={})", all.size());
                break;
            }

            for (IssueNode issue : response.issues) {
                if (issue == null || issue.key == null || issue.key.isBlank()) {
                    continue;
                }
                all.add(toSummary(issue));
            }

            log.info(
                    "Jira search page issues={} totalCollected={} isLast={} nextPageTokenPresent={}",
                    response.issues.size(),
                    all.size(),
                    response.isLast,
                    response.nextPageToken != null && !response.nextPageToken.isBlank());

            nextPageToken = response.nextPageToken;
            if (Boolean.TRUE.equals(response.isLast) || nextPageToken == null || nextPageToken.isBlank()) {
                break;
            }
        } while (true);

        log.info("Jira search complete projectKey={} fetched={}", jiraProjectKey, all.size());
        return all;
    }

    public List<JiraWorklogEntryRaw> getWorklogs(String issueKey) {
        if (issueKey == null || issueKey.isBlank()) {
            throw new BusinessException("VALIDATION", "Jira issue key is required", 400);
        }
        String key = issueKey.trim();
        String baseUrl = normalizedBaseUrl();
        List<JiraWorklogEntryRaw> all = new ArrayList<>();
        int startAt = 0;

        do {
            String path = "/rest/api/3/issue/" + encodePathSegment(key) + "/worklog?startAt=" + startAt
                    + "&maxResults=" + PAGE_SIZE;
            log.info("Jira request GET {}{}", baseUrl, path);

            WorklogPage page;
            try {
                page = restClient(baseUrl).get()
                        .uri(path)
                        .exchange((request, clientResponse) -> {
                            String responseBody = clientResponse.bodyTo(String.class);
                            int status = clientResponse.getStatusCode().value();
                            log.info(
                                    "Jira response GET {}{} status={} body={}",
                                    baseUrl,
                                    path,
                                    status,
                                    truncateForLog(responseBody));

                            if (clientResponse.getStatusCode().isError()) {
                                throw new RestClientResponseException(
                                        "Jira returned HTTP " + status,
                                        status,
                                        clientResponse.getStatusCode().toString(),
                                        clientResponse.getHeaders(),
                                        responseBody != null
                                                ? responseBody.getBytes(StandardCharsets.UTF_8)
                                                : null,
                                        StandardCharsets.UTF_8);
                            }
                            if (responseBody == null || responseBody.isBlank()) {
                                return new WorklogPage();
                            }
                            return objectMapper.readValue(responseBody, WorklogPage.class);
                        });
            } catch (RestClientResponseException e) {
                log.error(
                        "Jira worklog failed status={} body={}",
                        e.getStatusCode().value(),
                        truncateForLog(e.getResponseBodyAsString()));
                throw new BusinessException(
                        "JIRA_ERROR",
                        "Jira worklog fetch failed (" + e.getStatusCode().value() + ").",
                        502);
            } catch (RestClientException e) {
                log.error("Jira worklog unreachable: {}", e.getMessage());
                throw new BusinessException(
                        "JIRA_UNAVAILABLE",
                        "Could not reach Jira. Check JIRA_BASE_URL and network access.",
                        503);
            } catch (Exception e) {
                log.error("Jira worklog parse failed: {}", e.getMessage());
                throw new BusinessException(
                        "JIRA_ERROR",
                        "Jira worklog response could not be parsed.",
                        502);
            }

            if (page == null || page.worklogs == null || page.worklogs.isEmpty()) {
                break;
            }
            all.addAll(page.worklogs);
            int total = page.total != null ? page.total : all.size();
            startAt = all.size();
            if (startAt >= total || page.worklogs.size() < PAGE_SIZE) {
                break;
            }
        } while (true);

        log.info("Jira worklog complete issueKey={} fetched={}", key, all.size());
        return all;
    }

    public JiraTimeTracking getTimeTracking(String issueKey) {
        if (issueKey == null || issueKey.isBlank()) {
            throw new BusinessException("VALIDATION", "Jira issue key is required", 400);
        }
        String key = issueKey.trim();
        String baseUrl = normalizedBaseUrl();
        String path = "/rest/api/3/issue/" + encodePathSegment(key) + "?fields=timetracking";
        log.info("Jira request GET {}{}", baseUrl, path);

        try {
            IssueTimeTrackingResponse response = restClient(baseUrl).get()
                    .uri(path)
                    .exchange((request, clientResponse) -> {
                        String responseBody = clientResponse.bodyTo(String.class);
                        int status = clientResponse.getStatusCode().value();
                        log.info(
                                "Jira response GET {}{} status={} body={}",
                                baseUrl,
                                path,
                                status,
                                truncateForLog(responseBody));

                        if (clientResponse.getStatusCode().isError()) {
                            throw new RestClientResponseException(
                                    "Jira returned HTTP " + status,
                                    status,
                                    clientResponse.getStatusCode().toString(),
                                    clientResponse.getHeaders(),
                                    responseBody != null
                                            ? responseBody.getBytes(StandardCharsets.UTF_8)
                                            : null,
                                    StandardCharsets.UTF_8);
                        }
                        if (responseBody == null || responseBody.isBlank()) {
                            return new IssueTimeTrackingResponse();
                        }
                        return objectMapper.readValue(responseBody, IssueTimeTrackingResponse.class);
                    });

            TimeTrackingFields tracking = response != null && response.fields != null
                    ? response.fields.timetracking
                    : null;
            if (tracking == null) {
                return new JiraTimeTracking(null, null, null, null, null, null);
            }
            return new JiraTimeTracking(
                    tracking.originalEstimate,
                    tracking.originalEstimateSeconds,
                    tracking.remainingEstimate,
                    tracking.remainingEstimateSeconds,
                    tracking.timeSpent,
                    tracking.timeSpentSeconds);
        } catch (RestClientResponseException e) {
            log.error(
                    "Jira timetracking failed status={} body={}",
                    e.getStatusCode().value(),
                    truncateForLog(e.getResponseBodyAsString()));
            throw new BusinessException(
                    "JIRA_ERROR",
                    "Jira time tracking fetch failed (" + e.getStatusCode().value() + ").",
                    502);
        } catch (RestClientException e) {
            log.error("Jira timetracking unreachable: {}", e.getMessage());
            throw new BusinessException(
                    "JIRA_UNAVAILABLE",
                    "Could not reach Jira. Check JIRA_BASE_URL and network access.",
                    503);
        } catch (Exception e) {
            log.error("Jira timetracking parse failed: {}", e.getMessage());
            throw new BusinessException(
                    "JIRA_ERROR",
                    "Jira time tracking response could not be parsed.",
                    502);
        }
    }

    private static String encodePathSegment(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String toLogJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private static String truncateForLog(String body) {
        if (body == null) {
            return "<empty>";
        }
        if (body.length() <= MAX_LOG_BODY_CHARS) {
            return body;
        }
        return body.substring(0, MAX_LOG_BODY_CHARS) + "...[truncated " + body.length() + " chars]";
    }

    private static JiraIssueSummary toSummary(IssueNode issue) {
        Fields fields = issue.fields != null ? issue.fields : new Fields();
        String summary = fields.summary != null ? fields.summary.trim() : issue.key;
        String typeName = fields.issuetype != null ? fields.issuetype.name : null;
        String priorityName = fields.priority != null ? fields.priority.name : null;
        String description = extractPlainText(fields.description);
        return new JiraIssueSummary(issue.key.trim(), summary, typeName, priorityName, description);
    }

    private static String extractPlainText(JsonNode description) {
        if (description == null || description.isNull()) {
            return null;
        }
        if (description.isTextual()) {
            String text = description.asText();
            return text == null || text.isBlank() ? null : text.trim();
        }
        StringBuilder sb = new StringBuilder();
        collectText(description, sb);
        String text = sb.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static void collectText(JsonNode node, StringBuilder sb) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isTextual()) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(node.asText());
            return;
        }
        if (node.has("text") && node.get("text").isTextual()) {
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(node.get("text").asText());
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                collectText(child, sb);
            }
            return;
        }
        if (node.isObject() && node.has("content")) {
            collectText(node.get("content"), sb);
        }
    }

    static String buildCrJql(String jiraProjectKey, List<String> crIssueTypeNames) {
        StringBuilder typeList = new StringBuilder();
        for (String name : crIssueTypeNames) {
            if (name == null || name.isBlank()) {
                continue;
            }
            if (!typeList.isEmpty()) {
                typeList.append(", ");
            }
            typeList.append('"').append(name.trim().replace("\"", "\\\"")).append('"');
        }
        if (typeList.isEmpty()) {
            typeList.append("\"Change\", \"New Feature\"");
        }
        String key = jiraProjectKey.trim().replace("\"", "");
        return "project = \"" + key + "\" AND issuetype in (" + typeList + ") ORDER BY key ASC";
    }

    private String normalizedBaseUrl() {
        DfnPmProperties.Jira jira = properties.getJira();
        String base = jira.getBaseUrl() == null ? "" : jira.getBaseUrl().trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (base.isEmpty()) {
            throw new BusinessException("JIRA_CONFIG", "Jira base URL is not configured", 500);
        }
        return base;
    }

    private RestClient restClient(String baseUrl) {
        DfnPmProperties.Jira jira = properties.getJira();

        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.max(1_000, jira.getConnectTimeoutMs())))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofMillis(Math.max(1_000, jira.getReadTimeoutMs())));

        String credentials = jira.getEmail() + ":" + jira.getApiToken();
        String basic = Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .defaultHeader("Authorization", "Basic " + basic)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public record JiraIssueSummary(
            String key,
            String summary,
            String issueTypeName,
            String priorityName,
            String description) {
    }

    public record JiraTimeTracking(
            String originalEstimate,
            Integer originalEstimateSeconds,
            String remainingEstimate,
            Integer remainingEstimateSeconds,
            String timeSpent,
            Integer timeSpentSeconds) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JiraWorklogEntryRaw {
        public String id;
        public Author author;
        public String created;
        public String updated;
        public String started;
        public String timeSpent;
        public Integer timeSpentSeconds;
        public JsonNode comment;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Author {
        public String accountId;
        public String displayName;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class WorklogPage {
        public Integer startAt;
        public Integer maxResults;
        public Integer total;
        public List<JiraWorklogEntryRaw> worklogs;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class IssueTimeTrackingResponse {
        public IssueTimeTrackingFields fields;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class IssueTimeTrackingFields {
        public TimeTrackingFields timetracking;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class TimeTrackingFields {
        public String originalEstimate;
        public Integer originalEstimateSeconds;
        public String remainingEstimate;
        public Integer remainingEstimateSeconds;
        public String timeSpent;
        public Integer timeSpentSeconds;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class SearchResponse {
        public List<IssueNode> issues;
        public String nextPageToken;
        public Boolean isLast;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class IssueNode {
        public String key;
        public Fields fields;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class Fields {
        public String summary;
        public Named issuetype;
        public Named priority;
        public JsonNode description;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class Named {
        public String name;
    }
}
