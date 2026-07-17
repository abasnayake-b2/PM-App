package com.nexuspm.issue.field;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexuspm.issue.field.dto.CreateIssueFieldDefinitionRequest;
import com.nexuspm.issue.field.dto.IssueFieldDefinitionResponse;
import com.nexuspm.issue.field.dto.UpdateIssueFieldDefinitionRequest;
import com.nexuspm.issue.field.entity.IssueFieldDefinition;
import com.nexuspm.issue.field.repository.IssueFieldDefinitionRepository;
import com.nexuspm.issue.field.repository.IssueFieldValueRepository;
import com.nexuspm.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueFieldDefinitionService {

    private static final Set<String> ALLOWED_DATA_TYPES = Set.of(
            "TEXT", "NUMBER", "DATE", "YEAR", "DROPDOWN");

    private final IssueFieldDefinitionRepository definitionRepository;
    private final IssueFieldValueRepository valueRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<IssueFieldDefinitionResponse> listAll() {
        return definitionRepository.findAllByOrderByDisplayOrderAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<IssueFieldDefinitionResponse> listActive() {
        return definitionRepository.findByActiveTrueOrderByDisplayOrderAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IssueFieldDefinitionResponse create(CreateIssueFieldDefinitionRequest request) {
        String label = request.getLabel().trim();
        if (label.isEmpty()) {
            throw new BusinessException("VALIDATION", "Label is required", 400);
        }

        String dataType = normalizeDataType(request.getDataType());
        String fieldKey = resolveFieldKey(request.getFieldKey(), label);

        if (definitionRepository.existsByFieldKeyIgnoreCase(fieldKey)) {
            throw new BusinessException("DUPLICATE", "Field key already exists: " + fieldKey, 400);
        }

        String optionsJson = serializeOptions(dataType, request.getOptions());

        IssueFieldDefinition definition = new IssueFieldDefinition();
        definition.setId(UUID.randomUUID());
        definition.setFieldKey(fieldKey);
        definition.setLabel(label);
        definition.setDataType(dataType);
        definition.setMaxLength(request.getMaxLength());
        definition.setRequired(Boolean.TRUE.equals(request.getRequired()));
        definition.setActive(request.getActive() == null || Boolean.TRUE.equals(request.getActive()));
        definition.setSystemField(false);
        definition.setSectionCode(trimToNull(request.getSectionCode()));
        definition.setDisplayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0);
        definition.setOptionsJson(optionsJson);
        definition.setHelpText(trimToNull(request.getHelpText()));

        return toResponse(definitionRepository.save(definition));
    }

    @Transactional
    public IssueFieldDefinitionResponse update(UUID id, UpdateIssueFieldDefinitionRequest request) {
        IssueFieldDefinition definition = definitionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue field definition not found", 404));

        if (request.getLabel() != null) {
            String label = request.getLabel().trim();
            if (label.isEmpty()) {
                throw new BusinessException("VALIDATION", "Label cannot be blank", 400);
            }
            definition.setLabel(label);
        }
        if (request.getMaxLength() != null) {
            definition.setMaxLength(request.getMaxLength());
        }
        if (request.getRequired() != null) {
            definition.setRequired(request.getRequired());
        }
        if (request.getActive() != null) {
            definition.setActive(request.getActive());
        }
        if (request.getDisplayOrder() != null) {
            definition.setDisplayOrder(request.getDisplayOrder());
        }
        if (request.getHelpText() != null) {
            definition.setHelpText(trimToNull(request.getHelpText()));
        }
        if (request.getSectionCode() != null) {
            definition.setSectionCode(trimToNull(request.getSectionCode()));
        }
        if (request.getOptions() != null) {
            definition.setOptionsJson(serializeOptions(definition.getDataType(), request.getOptions()));
        }

        return toResponse(definitionRepository.save(definition));
    }

    @Transactional
    public void delete(UUID id) {
        IssueFieldDefinition definition = definitionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue field definition not found", 404));

        if (definition.isSystemField()) {
            throw new BusinessException(
                    "FORBIDDEN",
                    "System fields cannot be deleted; deactivate them instead",
                    400);
        }
        if (valueRepository.existsByFieldDefinition_Id(id)) {
            throw new BusinessException(
                    "IN_USE",
                    "Field has stored values and cannot be deleted; deactivate it instead",
                    400);
        }
        definitionRepository.delete(definition);
    }

    private IssueFieldDefinitionResponse toResponse(IssueFieldDefinition definition) {
        return IssueFieldDefinitionResponse.builder()
                .id(definition.getId())
                .fieldKey(definition.getFieldKey())
                .label(definition.getLabel())
                .dataType(definition.getDataType())
                .maxLength(definition.getMaxLength())
                .required(definition.isRequired())
                .active(definition.isActive())
                .systemField(definition.isSystemField())
                .sectionCode(definition.getSectionCode())
                .displayOrder(definition.getDisplayOrder())
                .options(parseOptions(definition.getOptionsJson()))
                .helpText(definition.getHelpText())
                .build();
    }

    List<String> parseOptions(String optionsJson) {
        if (optionsJson == null || optionsJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(optionsJson, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private String serializeOptions(String dataType, List<String> options) {
        if ("DROPDOWN".equals(dataType)) {
            if (options == null || options.isEmpty()) {
                throw new BusinessException("VALIDATION", "Options are required for DROPDOWN fields", 400);
            }
            List<String> cleaned = options.stream()
                    .map(o -> o == null ? "" : o.trim())
                    .filter(o -> !o.isEmpty())
                    .toList();
            if (cleaned.isEmpty()) {
                throw new BusinessException("VALIDATION", "Options are required for DROPDOWN fields", 400);
            }
            try {
                return objectMapper.writeValueAsString(cleaned);
            } catch (JsonProcessingException e) {
                throw new BusinessException("VALIDATION", "Invalid options", 400);
            }
        }
        if (options != null && !options.isEmpty()) {
            throw new BusinessException("VALIDATION", "Options are only allowed for DROPDOWN fields", 400);
        }
        return null;
    }

    private String normalizeDataType(String dataType) {
        if (dataType == null || dataType.isBlank()) {
            throw new BusinessException("VALIDATION", "dataType is required", 400);
        }
        String normalized = dataType.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_DATA_TYPES.contains(normalized)) {
            throw new BusinessException(
                    "VALIDATION",
                    "Invalid dataType. Allowed: TEXT, NUMBER, DATE, YEAR, DROPDOWN",
                    400);
        }
        return normalized;
    }

    private String resolveFieldKey(String requestedKey, String label) {
        String key = requestedKey != null && !requestedKey.isBlank()
                ? toSnakeCase(requestedKey.trim())
                : toSnakeCase(label);
        if (key.isEmpty()) {
            throw new BusinessException("VALIDATION", "fieldKey could not be derived from label", 400);
        }
        if (key.length() > 80) {
            throw new BusinessException("VALIDATION", "fieldKey must be at most 80 characters", 400);
        }
        return key;
    }

    static String toSnakeCase(String input) {
        String normalized = input.trim()
                .replaceAll("([a-z])([A-Z])", "$1_$2")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "")
                .replaceAll("_+", "_");
        return normalized;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
