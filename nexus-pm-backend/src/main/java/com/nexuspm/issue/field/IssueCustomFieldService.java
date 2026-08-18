package com.nexuspm.issue.field;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.field.entity.IssueFieldDefinition;
import com.nexuspm.issue.field.entity.IssueFieldValue;
import com.nexuspm.issue.field.repository.IssueFieldDefinitionRepository;
import com.nexuspm.issue.field.repository.IssueFieldValueRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IssueCustomFieldService {

    private static final List<List<String>> DATE_CHAINS = List.of(
            List.of(
                    "requirement_initiated_date",
                    "brd_requested_date",
                    "brd_received_date",
                    "bp_effort_eta",
                    "bp_effort_accepted_date",
                    "total_effort_eta",
                    "rd_start_date",
                    "rd_delivery_eta",
                    "rd_sign_off_date",
                    "quotation_shared_date",
                    "quotation_approved_date",
                    "dev_start_date",
                    "dev_end_date",
                    "sit_start_date",
                    "sit_end_date",
                    "uat_start_date",
                    "uat_end_date",
                    "prod_date"));

    private final IssueFieldDefinitionRepository definitionRepository;
    private final IssueFieldValueRepository valueRepository;
    private final IssueFieldDefinitionService definitionService;
    private final RdIssueRepository issueRepository;

    @Transactional(readOnly = true)
    public Map<String, String> loadValuesAsMap(UUID issueId) {
        List<IssueFieldValue> values = valueRepository.findByIssueId(issueId);
        Map<String, String> result = new LinkedHashMap<>();
        for (IssueFieldValue value : values) {
            String stringValue = toStringValue(value);
            if (stringValue != null) {
                result.put(value.getFieldDefinition().getFieldKey(), stringValue);
            }
        }
        return result;
    }

    /** Bulk-load custom field maps for list/grid views. */
    @Transactional(readOnly = true)
    public Map<UUID, Map<String, String>> loadValuesAsMaps(List<UUID> issueIds) {
        if (issueIds == null || issueIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Map<String, String>> out = new LinkedHashMap<>();
        final int batchSize = 500;
        for (int i = 0; i < issueIds.size(); i += batchSize) {
            List<UUID> batch = issueIds.subList(i, Math.min(i + batchSize, issueIds.size()));
            for (IssueFieldValue value : valueRepository.findByIssue_IdIn(batch)) {
                String stringValue = toStringValue(value);
                if (stringValue == null) {
                    continue;
                }
                out.computeIfAbsent(value.getIssue().getId(), ignored -> new LinkedHashMap<>())
                        .put(value.getFieldDefinition().getFieldKey(), stringValue);
            }
        }
        return out;
    }

    /**
     * Upserts custom field values for an issue. Empty / blank values delete stored rows.
     * When {@code enforceRequired} is true (create), every active required field must be present and non-blank.
     * When false (update), required fields may only be cleared if not required; omitted keys are left unchanged.
     */
    @Transactional
    public void saveValues(UUID issueId, Map<String, String> values, boolean enforceRequired) {
        if (values == null) {
            return;
        }

        RdIssue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));

        List<IssueFieldDefinition> activeDefs = definitionRepository.findByActiveTrueOrderByDisplayOrderAsc();
        Map<String, IssueFieldDefinition> defsByKey = activeDefs.stream()
                .collect(Collectors.toMap(IssueFieldDefinition::getFieldKey, Function.identity(), (a, b) -> a));

        for (String key : values.keySet()) {
            if (!defsByKey.containsKey(key)) {
                throw new BusinessException("VALIDATION", "Unknown or inactive custom field: " + key, 400);
            }
        }

        if (enforceRequired) {
            for (IssueFieldDefinition definition : activeDefs) {
                if (!definition.isRequired()) {
                    continue;
                }
                String raw = values.get(definition.getFieldKey());
                if (raw == null || raw.isBlank()) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + definition.getLabel() + "' is required",
                            400);
                }
            }
        }

        Map<UUID, IssueFieldValue> existingByDefId = valueRepository.findByIssueId(issueId).stream()
                .collect(Collectors.toMap(v -> v.getFieldDefinition().getId(), Function.identity(), (a, b) -> a));

        Map<String, String> effectiveValues = new LinkedHashMap<>(loadValuesAsMap(issueId));
        for (Map.Entry<String, String> entry : values.entrySet()) {
            String raw = entry.getValue();
            if (raw == null || raw.isBlank()) {
                effectiveValues.remove(entry.getKey());
            } else {
                effectiveValues.put(entry.getKey(), raw.trim());
            }
        }
        validateBusinessRules(effectiveValues, defsByKey);

        for (Map.Entry<String, String> entry : values.entrySet()) {
            IssueFieldDefinition definition = defsByKey.get(entry.getKey());
            String raw = entry.getValue();
            boolean empty = raw == null || raw.isBlank();

            IssueFieldValue existing = existingByDefId.get(definition.getId());

            if (empty) {
                if (definition.isRequired()) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + definition.getLabel() + "' is required",
                            400);
                }
                if (existing != null) {
                    valueRepository.delete(existing);
                }
                continue;
            }

            ParsedValue parsed = validateAndParse(definition, raw.trim());
            if (existing == null) {
                existing = new IssueFieldValue();
                existing.setId(UUID.randomUUID());
                existing.setIssue(issue);
                existing.setFieldDefinition(definition);
            }
            clearTypedValues(existing);
            applyParsed(existing, parsed);
            valueRepository.save(existing);
        }
    }

    private void validateBusinessRules(
            Map<String, String> values,
            Map<String, IssueFieldDefinition> defsByKey) {
        String pctRaw = values.get("percentage_completion");
        if (pctRaw != null && !pctRaw.isBlank()) {
            try {
                BigDecimal pct = new BigDecimal(pctRaw.trim());
                if (pct.compareTo(BigDecimal.ZERO) < 0 || pct.compareTo(BigDecimal.valueOf(100)) > 0) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Percentage Completion must be a number between 0 and 100",
                            400);
                }
            } catch (NumberFormatException e) {
                throw new BusinessException(
                        "VALIDATION",
                        "Percentage Completion must be a number between 0 and 100",
                        400);
            }
        }

        for (List<String> chain : DATE_CHAINS) {
            List<String> filledKeys = new ArrayList<>();
            List<LocalDate> filledDates = new ArrayList<>();
            for (String key : chain) {
                String raw = values.get(key);
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                try {
                    filledKeys.add(key);
                    filledDates.add(LocalDate.parse(raw.trim()));
                } catch (DateTimeParseException e) {
                    IssueFieldDefinition def = defsByKey.get(key);
                    String label = def != null ? def.getLabel() : key;
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + label + "' must be a date (YYYY-MM-DD)",
                            400);
                }
            }
            for (int i = 0; i < filledDates.size() - 1; i++) {
                if (filledDates.get(i).isAfter(filledDates.get(i + 1))) {
                    IssueFieldDefinition earlier = defsByKey.get(filledKeys.get(i));
                    IssueFieldDefinition later = defsByKey.get(filledKeys.get(i + 1));
                    String earlierLabel = earlier != null ? earlier.getLabel() : filledKeys.get(i);
                    String laterLabel = later != null ? later.getLabel() : filledKeys.get(i + 1);
                    throw new BusinessException(
                            "VALIDATION",
                            laterLabel + " must be on or after " + earlierLabel,
                            400);
                }
            }
        }
    }

    ParsedValue validateAndParse(IssueFieldDefinition definition, String raw) {
        if ("percentage_completion".equals(definition.getFieldKey())) {
            try {
                BigDecimal pct = new BigDecimal(raw);
                if (pct.compareTo(BigDecimal.ZERO) < 0 || pct.compareTo(BigDecimal.valueOf(100)) > 0) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Percentage Completion must be a number between 0 and 100",
                            400);
                }
                return ParsedValue.text(pct.stripTrailingZeros().toPlainString());
            } catch (NumberFormatException e) {
                throw new BusinessException(
                        "VALIDATION",
                        "Percentage Completion must be a number between 0 and 100",
                        400);
            }
        }

        String dataType = definition.getDataType() == null
                ? "TEXT"
                : definition.getDataType().toUpperCase(Locale.ROOT);

        if (definition.getMaxLength() != null
                && ("TEXT".equals(dataType) || "DROPDOWN".equals(dataType))
                && raw.length() > definition.getMaxLength()) {
            throw new BusinessException(
                    "VALIDATION",
                    "Field '" + definition.getLabel() + "' exceeds max length of " + definition.getMaxLength(),
                    400);
        }

        return switch (dataType) {
            case "TEXT" -> ParsedValue.text(raw);
            case "DROPDOWN" -> {
                List<String> options = definitionService.parseOptions(definition.getOptionsJson());
                if (!options.contains(raw)) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + definition.getLabel() + "' must be one of: " + String.join(", ", options),
                            400);
                }
                yield ParsedValue.text(raw);
            }
            case "NUMBER" -> {
                try {
                    yield ParsedValue.number(new BigDecimal(raw));
                } catch (NumberFormatException e) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + definition.getLabel() + "' must be a number",
                            400);
                }
            }
            case "YEAR" -> {
                try {
                    int year = Integer.parseInt(raw);
                    if (year < 1900 || year > 2100) {
                        throw new BusinessException(
                                "VALIDATION",
                                "Field '" + definition.getLabel() + "' must be a valid year",
                                400);
                    }
                    yield ParsedValue.number(BigDecimal.valueOf(year));
                } catch (NumberFormatException e) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + definition.getLabel() + "' must be a valid year",
                            400);
                }
            }
            case "DATE" -> {
                try {
                    yield ParsedValue.date(LocalDate.parse(raw));
                } catch (DateTimeParseException e) {
                    throw new BusinessException(
                            "VALIDATION",
                            "Field '" + definition.getLabel() + "' must be a date (YYYY-MM-DD)",
                            400);
                }
            }
            default -> throw new BusinessException(
                    "VALIDATION",
                    "Unsupported data type for field '" + definition.getLabel() + "'",
                    400);
        };
    }

    private static String toStringValue(IssueFieldValue value) {
        if (value.getValueText() != null) {
            return value.getValueText();
        }
        if (value.getValueNumber() != null) {
            return value.getValueNumber().stripTrailingZeros().toPlainString();
        }
        if (value.getValueDate() != null) {
            return value.getValueDate().toString();
        }
        if (value.getValueBool() != null) {
            return value.getValueBool().toString();
        }
        return null;
    }

    private static void clearTypedValues(IssueFieldValue value) {
        value.setValueText(null);
        value.setValueNumber(null);
        value.setValueDate(null);
        value.setValueBool(null);
    }

    private static void applyParsed(IssueFieldValue value, ParsedValue parsed) {
        value.setValueText(parsed.text());
        value.setValueNumber(parsed.number());
        value.setValueDate(parsed.date());
        value.setValueBool(parsed.bool());
    }

    record ParsedValue(String text, BigDecimal number, LocalDate date, Boolean bool) {
        static ParsedValue text(String text) {
            return new ParsedValue(text, null, null, null);
        }

        static ParsedValue number(BigDecimal number) {
            return new ParsedValue(null, number, null, null);
        }

        static ParsedValue date(LocalDate date) {
            return new ParsedValue(null, null, date, null);
        }
    }
}
