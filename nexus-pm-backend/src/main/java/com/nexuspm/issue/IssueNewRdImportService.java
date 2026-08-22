package com.nexuspm.issue;

import com.nexuspm.issue.dto.IssueImportResult;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueNote;
import com.nexuspm.issue.entity.RdIssueRisk;
import com.nexuspm.issue.field.IssueCustomFieldService;
import com.nexuspm.issue.field.IssueFieldDefinitionService;
import com.nexuspm.issue.field.entity.IssueFieldDefinition;
import com.nexuspm.issue.field.repository.IssueFieldDefinitionRepository;
import com.nexuspm.issue.repository.RdIssueNoteRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.issue.repository.RdIssueRiskRepository;
import com.nexuspm.lookup.IssueTypeCatalog;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.util.ExcelUploadValidator;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueNewRdImportService {

    private static final Set<String> SKIP_SHEETS = Set.of(
            "summary", "allrds", "allrd", "instructions", "readme", "mapping", "legend");
    private static final Set<String> RISK_STATUSES = Set.of("Open", "Closed", "Hold", "Rejected");
    private static final Set<String> RISK_IMPACTS = Set.of("Low", "Mid", "High");
    private static final List<DateTimeFormatter> DATE_FORMATS = buildDateFormats();

    private static final Map<String, String> TYPE_TO_WORKFLOW = Map.ofEntries(
            Map.entry("epic", "EPIC"),
            Map.entry("epics", "EPIC"),
            Map.entry("story", "STORY"),
            Map.entry("stories", "STORY"),
            Map.entry("task", "TASK"),
            Map.entry("tasks", "TASK"),
            Map.entry("bug", "BUG"),
            Map.entry("bugs", "BUG"),
            Map.entry("changerequest", "CHANGE"),
            Map.entry("change", "CHANGE"),
            Map.entry("cr", "CHANGE"),
            Map.entry("amc", "CHANGE"));

    private final RdIssueRepository issueRepository;
    private final ProjectRepository projectRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final PriorityRepository priorityRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final EmployeeRepository employeeRepository;
    private final IssueFieldDefinitionRepository definitionRepository;
    private final IssueFieldDefinitionService definitionService;
    private final IssueCustomFieldService customFieldService;
    private final RdIssueRiskRepository riskRepository;
    private final RdIssueNoteRepository noteRepository;
    private final IssueKeyAllocator issueKeyAllocator;
    private final AuditLogService auditLogService;
    private final DfnPmProperties properties;
    private final PlatformTransactionManager transactionManager;

    public IssueImportResult importNewRdExcel(MultipartFile file) {
        ExcelUploadValidator.validate(file, properties);
        if (!SecurityUtils.isAdmin()) {
            throw new BusinessException("ACCESS_DENIED", "Only admins can import the new RD Excel", 403);
        }

        UUID importerId = SecurityUtils.currentUserId();
        if (importerId == null) {
            throw new BusinessException("ACCESS_DENIED", "Authenticated user required", 403);
        }
        Employee importer = employeeRepository.findById(importerId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Current user not found", 404));

        Map<String, IssueType> issueTypesByCode = indexIssueTypesByWorkflowCode();
        Map<String, Priority> prioritiesByLabel = indexPrioritiesByLabel();
        Map<String, IssueStatus> statusesByName = indexStatusesByName();
        IssueStatus defaultStatus = issueStatusRepository.findByName(IssueLifecycleStatuses.DEFAULT_STATUS)
                .orElseThrow(() -> new BusinessException("CONFIG_ERROR", "Default status not configured", 500));
        IssueType defaultType = issueTypesByCode.get("CHANGE");
        if (defaultType == null) {
            throw new BusinessException("CONFIG_ERROR", "Change Request issue type is not configured", 500);
        }

        Map<String, IssueFieldDefinition> defsByKey = new HashMap<>();
        Map<String, String> labelToFieldKey = new HashMap<>();
        for (IssueFieldDefinition definition : definitionRepository.findByActiveTrueOrderByDisplayOrderAsc()) {
            defsByKey.put(definition.getFieldKey(), definition);
            boolean skipAuto = "notes".equals(definition.getFieldKey())
                    || ("RISK".equalsIgnoreCase(definition.getSectionCode())
                    && !"risk_count".equals(definition.getFieldKey()));
            if (!skipAuto) {
                labelToFieldKey.put(IssueNewRdColumnMap.normalize(definition.getLabel()), definition.getFieldKey());
                labelToFieldKey.put(IssueNewRdColumnMap.normalize(definition.getFieldKey()), definition.getFieldKey());
            }
        }

        int skipped = 0;
        List<String> errors = new ArrayList<>();
        List<String> detectedColumns = new ArrayList<>();
        ImportCounters counters = new ImportCounters();

        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            int dataSheets = 0;
            for (int s = 0; s < workbook.getNumberOfSheets(); s++) {
                Sheet sheet = workbook.getSheetAt(s);
                if (sheet == null || shouldSkipSheet(sheet.getSheetName())) {
                    continue;
                }
                Row header = findHeaderRow(sheet, labelToFieldKey);
                if (header == null) {
                    continue;
                }
                Map<Integer, IssueNewRdColumnMap.Target> columns = parseHeader(header, labelToFieldKey);
                if (!isRdSheet(columns)) {
                    continue;
                }
                dataSheets++;
                if (detectedColumns.isEmpty()) {
                    detectedColumns.addAll(readHeaderLabels(header));
                }
                String sheetProjectHint = sheetProjectHint(sheet.getSheetName());
                int dataStart = header.getRowNum() + 1;
                TransactionTemplate rowTx = new TransactionTemplate(transactionManager);
                rowTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                for (int rowIdx = dataStart; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                    Row row = sheet.getRow(rowIdx);
                    if (row == null) {
                        continue;
                    }
                    int excelRow = row.getRowNum() + 1;
                    try {
                        String rowError = rowTx.execute(status -> importRow(
                                sheet.getSheetName(),
                                row,
                                columns,
                                sheetProjectHint,
                                defsByKey,
                                issueTypesByCode,
                                defaultType,
                                prioritiesByLabel,
                                statusesByName,
                                defaultStatus,
                                importer,
                                importerId,
                                counters,
                                errors));
                        if (rowError != null) {
                            errors.add(rowError);
                            skipped++;
                        }
                    } catch (RuntimeException ex) {
                        errors.add(rowMessage(sheet.getSheetName(), excelRow, rootMessage(ex)));
                        skipped++;
                    }
                }
            }
            if (dataSheets == 0) {
                throw new BusinessException(
                        "IMPORT_FAILED",
                        "No RD header row found. Put Change Request Name or CR # in the header (it can be below title rows).",
                        400);
            }
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("IMPORT_FAILED", "Failed to read Excel file: " + ex.getMessage(), 400);
        }

        return IssueImportResult.builder()
                .fileName(file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx")
                .created(counters.created)
                .updated(counters.updated)
                .skipped(skipped)
                .errors(errors)
                .detectedColumns(detectedColumns)
                .importedByName(importer.getFullName())
                .importedAt(Instant.now())
                .build();
    }

    private String importRow(
            String sheetName,
            Row row,
            Map<Integer, IssueNewRdColumnMap.Target> columns,
            String sheetProjectHint,
            Map<String, IssueFieldDefinition> defsByKey,
            Map<String, IssueType> issueTypesByCode,
            IssueType defaultType,
            Map<String, Priority> prioritiesByLabel,
            Map<String, IssueStatus> statusesByName,
            IssueStatus defaultStatus,
            Employee importer,
            UUID importerId,
            ImportCounters counters,
            List<String> errors) {
        int excelRow = row.getRowNum() + 1;
        Map<IssueNewRdColumnMap.Kind, String> cores = new EnumMap<>(IssueNewRdColumnMap.Kind.class);

        for (Map.Entry<Integer, IssueNewRdColumnMap.Target> entry : columns.entrySet()) {
            Cell cell = row.getCell(entry.getKey());
            IssueNewRdColumnMap.Target target = entry.getValue();
            String raw = cellRaw(cell);
            if (raw == null) {
                continue;
            }
            if (target.kind() != IssueNewRdColumnMap.Kind.CUSTOM && !cores.containsKey(target.kind())) {
                cores.put(target.kind(), raw);
            }
        }

        String title = trimToNull(cores.get(IssueNewRdColumnMap.Kind.TITLE));
        String bmsId = trimToNull(cores.get(IssueNewRdColumnMap.Kind.BMS_ID));
        if (title == null && bmsId == null) {
            return null;
        }
        if (title == null) {
            return rowMessage(sheetName, excelRow, "Change Request Name is required");
        }

        String projectKey = firstNonBlank(
                cores.get(IssueNewRdColumnMap.Kind.PROJECT),
                cores.get(IssueNewRdColumnMap.Kind.PRODUCT),
                sheetProjectHint);
        LookupResult<Project> projectResult = lookupProject(projectKey);
        if (projectResult.error() != null) {
            return rowMessage(sheetName, excelRow, projectResult.error());
        }
        Project project = projectResult.value();

        LookupResult<IssueType> typeResult = lookupIssueType(
                issueTypesByCode, defaultType, cores.get(IssueNewRdColumnMap.Kind.TYPE));
        if (typeResult.error() != null) {
            return rowMessage(sheetName, excelRow, typeResult.error());
        }

        LookupResult<Priority> priorityResult = lookupPriority(
                prioritiesByLabel, cores.get(IssueNewRdColumnMap.Kind.PRIORITY));
        if (priorityResult.error() != null) {
            return rowMessage(sheetName, excelRow, priorityResult.error());
        }

        LookupResult<IssueStatus> statusResult = lookupStatus(
                statusesByName, cores.get(IssueNewRdColumnMap.Kind.STATUS), defaultStatus);
        if (statusResult.error() != null) {
            return rowMessage(sheetName, excelRow, statusResult.error());
        }

        RdIssue issue = findExistingByExcelKey(project, bmsId);
        boolean created = issue == null;
        if (created) {
            issue = new RdIssue();
            issue.setId(UUID.randomUUID());
            issue.setProject(projectRepository.getReferenceById(project.getId()));
            issue.setReportedBy(employeeRepository.getReferenceById(importerId));
            issue.setSlaStatus("WITHIN");
            issueKeyAllocator.assignRootFromExcel(issue, project, IssueDisplayKeys.parseExcelRdNumber(bmsId));
        }

        issue.setTitle(title);
        issue.setBmsId(bmsId);
        String jiraId = trimToNull(cores.get(IssueNewRdColumnMap.Kind.JIRA_ID));
        if (jiraId != null || created) {
            issue.setJiraId(jiraId);
        }
        issue.setIssueType(issueTypeRepository.getReferenceById(typeResult.value().getId()));
        issue.setPriority(priorityRepository.getReferenceById(priorityResult.value().getId()));
        issue.setStatus(issueStatusRepository.getReferenceById(statusResult.value().getId()));
        if (!statusResult.value().isTerminal() && priorityResult.value().getSlaResolveHrs() != null) {
            Instant base = issue.getCreatedAt() != null ? issue.getCreatedAt() : Instant.now();
            issue.setSlaDueAt(base.plus(priorityResult.value().getSlaResolveHrs(), ChronoUnit.HOURS));
        }
        issueRepository.save(issue);

        Map<String, String> customValues = new LinkedHashMap<>();
        for (Map.Entry<Integer, IssueNewRdColumnMap.Target> entry : columns.entrySet()) {
            IssueNewRdColumnMap.Target target = entry.getValue();
            if (target.kind() != IssueNewRdColumnMap.Kind.CUSTOM) {
                continue;
            }
            IssueFieldDefinition definition = defsByKey.get(target.fieldKey());
            if (definition == null || customValues.containsKey(target.fieldKey())) {
                continue;
            }
            Cell cell = row.getCell(entry.getKey());
            String coerced = coerceCell(definition, cell);
            if (coerced != null) {
                customValues.put(target.fieldKey(), coerced);
            } else if (cellRaw(cell) != null) {
                errors.add(rowMessage(
                        sheetName,
                        excelRow,
                        definition.getLabel() + ": value not imported (" + cellRaw(cell) + ")"));
            } else {
                customValues.put(target.fieldKey(), "");
            }
        }
        if (!customValues.isEmpty()) {
            customFieldService.saveValues(issue.getId(), customValues, false, false);
        }

        upsertRisk(issue, columns, row);
        upsertNote(issue, cores.get(IssueNewRdColumnMap.Kind.NOTE), importer);

        String auditDetail = (created ? "Created" : "Updated") + " from New RD Excel";
        auditLogService.log(importerId, created ? "CREATE" : "UPDATE", "ISSUE", issue.getId(), auditDetail, null);
        if (created) {
            counters.created++;
        } else {
            counters.updated++;
        }
        return null;
    }

    /**
     * Update only when CR No / ID already exists as {@code {Project Name}-RD-{CR #}}.
     * BMS ID and title are not used to match.
     */
    private RdIssue findExistingByExcelKey(Project project, String bmsId) {
        Integer excelRdNumber = IssueDisplayKeys.parseExcelRdNumber(bmsId);
        if (excelRdNumber == null) {
            return null;
        }
        String excelKey = IssueDisplayKeys.rdKey(
                IssueDisplayKeys.projectKeyPrefix(project), excelRdNumber);
        return issueRepository.findByDisplayKeyIgnoreCaseAndDeletedFalse(excelKey).orElse(null);
    }

    private void upsertRisk(RdIssue issue, Map<Integer, IssueNewRdColumnMap.Target> columns, Row row) {
        String description = cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_DESCRIPTION);
        LocalDate created = parseDateValue(cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_CREATED),
                cellForKindCell(columns, row, IssueNewRdColumnMap.Kind.RISK_CREATED));
        String owner = cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_OWNER);
        String status = matchKnown(cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_STATUS), RISK_STATUSES);
        String impact = matchRiskImpact(cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_IMPACT));
        LocalDate closed = parseDateValue(cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_CLOSED),
                cellForKindCell(columns, row, IssueNewRdColumnMap.Kind.RISK_CLOSED));
        String mitigation = cellForKind(columns, row, IssueNewRdColumnMap.Kind.RISK_MITIGATION);

        boolean any = description != null || created != null || owner != null || status != null
                || impact != null || closed != null || mitigation != null;
        if (!any) {
            return;
        }
        if (created != null && closed != null && closed.isBefore(created)) {
            throw new BusinessException("VALIDATION", "Risk Closed Date cannot be before Risk Created Date", 400);
        }

        List<RdIssueRisk> existing = riskRepository.findActiveByIssueId(issue.getId());
        RdIssueRisk risk;
        if (existing.isEmpty()) {
            risk = new RdIssueRisk();
            risk.setId(UUID.randomUUID());
            risk.setIssue(issue);
            risk.setRiskNumber(riskRepository.findMaxRiskNumber(issue.getId()) + 1);
        } else {
            risk = existing.getFirst();
        }
        if (description != null) {
            risk.setDescription(description);
        }
        if (created != null) {
            risk.setCreatedDate(created);
        }
        if (owner != null) {
            risk.setOwner(owner);
        }
        if (status != null) {
            risk.setStatus(status);
        }
        if (impact != null) {
            risk.setImpact(impact);
        }
        if (closed != null) {
            risk.setClosedDate(closed);
        }
        if (mitigation != null) {
            risk.setMitigation(mitigation);
        }
        riskRepository.save(risk);
    }

    private void upsertNote(RdIssue issue, String noteText, Employee importer) {
        String note = trimToNull(noteText);
        if (note == null) {
            return;
        }
        List<RdIssueNote> existing = noteRepository.findActiveByIssueId(issue.getId());
        boolean duplicate = existing.stream().anyMatch(row -> note.equalsIgnoreCase(row.getNote()));
        if (duplicate) {
            return;
        }
        RdIssueNote row = new RdIssueNote();
        row.setId(UUID.randomUUID());
        row.setIssue(issue);
        row.setNoteDate(LocalDate.now());
        row.setNote(note);
        String owner = importer.getFullName();
        if (owner == null || owner.isBlank()) {
            owner = "Import";
        }
        row.setOwner(owner.trim());
        noteRepository.save(row);
    }

    private LookupResult<Project> lookupProject(String projectKey) {
        if (isBlank(projectKey)) {
            return LookupResult.fail("Project Name is required (Project Name column, Product column, or sheet name)");
        }
        List<Project> matches = projectRepository.findActiveByProductOrNameIgnoreCase(projectKey.trim());
        if (matches.isEmpty()) {
            return LookupResult.fail("No project found for product or name: " + projectKey.trim());
        }
        if (matches.size() > 1) {
            return LookupResult.fail(
                    "Multiple projects match \"" + projectKey.trim() + "\" — use a unique product code");
        }
        return LookupResult.ok(matches.getFirst());
    }

    private LookupResult<IssueType> lookupIssueType(
            Map<String, IssueType> issueTypesByCode, IssueType defaultType, String rawType) {
        if (isBlank(rawType)) {
            return LookupResult.ok(defaultType);
        }
        String workflowCode = TYPE_TO_WORKFLOW.get(IssueNewRdColumnMap.normalize(rawType));
        if (workflowCode == null) {
            return LookupResult.fail("Unsupported type: " + rawType.trim());
        }
        IssueType issueType = issueTypesByCode.get(workflowCode);
        if (issueType == null) {
            return LookupResult.fail("Issue type not configured: " + workflowCode);
        }
        return LookupResult.ok(issueType);
    }

    private LookupResult<Priority> lookupPriority(Map<String, Priority> prioritiesByLabel, String raw) {
        if (isBlank(raw)) {
            Priority fallback = defaultPriority(prioritiesByLabel);
            if (fallback == null) {
                return LookupResult.fail("Priority is required");
            }
            return LookupResult.ok(fallback);
        }
        Priority priority = prioritiesByLabel.get(IssueNewRdColumnMap.normalize(raw));
        if (priority == null) {
            return LookupResult.fail("Unknown priority: " + raw.trim());
        }
        return LookupResult.ok(priority);
    }

    private static Priority defaultPriority(Map<String, Priority> prioritiesByLabel) {
        for (String key : List.of("medium", "low", "p3", "p2")) {
            Priority match = prioritiesByLabel.get(key);
            if (match != null) {
                return match;
            }
        }
        return prioritiesByLabel.values().stream().findFirst().orElse(null);
    }

    private LookupResult<IssueStatus> lookupStatus(
            Map<String, IssueStatus> statusesByName, String rawStage, IssueStatus defaultStatus) {
        if (isBlank(rawStage)) {
            return LookupResult.ok(defaultStatus);
        }
        IssueStatus matched = statusesByName.get(IssueNewRdColumnMap.normalize(rawStage));
        if (matched != null) {
            return LookupResult.ok(matched);
        }
        return LookupResult.fail("Unknown current stage: " + rawStage.trim());
    }

    private Row findHeaderRow(Sheet sheet, Map<String, String> labelToFieldKey) {
        int last = Math.min(sheet.getLastRowNum(), 60);
        Row best = null;
        int bestScore = 0;
        for (int i = 0; i <= last; i++) {
            Row row = sheet.getRow(i);
            if (row == null) {
                continue;
            }
            Map<Integer, IssueNewRdColumnMap.Target> columns = parseHeader(row, labelToFieldKey);
            if (!isRdSheet(columns)) {
                continue;
            }
            int score = columns.size();
            if (columns.values().stream().anyMatch(t -> t.kind() == IssueNewRdColumnMap.Kind.TITLE)) {
                score += 10;
            }
            if (columns.values().stream().anyMatch(t -> t.kind() == IssueNewRdColumnMap.Kind.PROJECT)) {
                score += 5;
            }
            if (score > bestScore) {
                bestScore = score;
                best = row;
            }
        }
        return best;
    }

    private Map<Integer, IssueNewRdColumnMap.Target> parseHeader(
            Row header, Map<String, String> labelToFieldKey) {
        Map<Integer, IssueNewRdColumnMap.Target> columns = new LinkedHashMap<>();
        short last = header.getLastCellNum();
        for (int i = 0; i < last; i++) {
            String label = trimToNull(cellRaw(header.getCell(i)));
            if (label == null) {
                continue;
            }
            IssueNewRdColumnMap.Target target = IssueNewRdColumnMap.resolve(label, labelToFieldKey);
            if (target != null) {
                columns.put(i, target);
            }
        }
        return columns;
    }

    private static boolean isRdSheet(Map<Integer, IssueNewRdColumnMap.Target> columns) {
        return columns.values().stream().anyMatch(target ->
                target.kind() == IssueNewRdColumnMap.Kind.TITLE
                        || target.kind() == IssueNewRdColumnMap.Kind.BMS_ID);
    }

    private static boolean shouldSkipSheet(String name) {
        String key = IssueNewRdColumnMap.normalize(name);
        return SKIP_SHEETS.contains(key);
    }

    private static String sheetProjectHint(String sheetName) {
        if (sheetName == null) {
            return null;
        }
        String key = IssueNewRdColumnMap.normalize(sheetName);
        if (key.isEmpty() || "rd".equals(key) || "newrd".equals(key) || key.startsWith("sheet")) {
            return null;
        }
        return sheetName.trim();
    }

    private String coerceCell(IssueFieldDefinition definition, Cell cell) {
        if (cell == null) {
            return null;
        }
        String dataType = definition.getDataType() == null ? "TEXT" : definition.getDataType().toUpperCase(Locale.ROOT);
        if ("DATE".equals(dataType)) {
            LocalDate date = parseDateCell(cell);
            return date != null ? date.toString() : null;
        }
        if ("YEAR".equals(dataType)) {
            LocalDate date = parseDateCell(cell);
            if (date != null) {
                return String.valueOf(date.getYear());
            }
            return extractYear(cellRaw(cell));
        }
        if ("delivery_quarter".equals(definition.getFieldKey())) {
            return matchDropdown(
                    normalizeQuarter(cellRaw(cell)),
                    definitionService.parseOptions(definition.getOptionsJson()));
        }
        if ("NUMBER".equals(dataType) || "percentage_completion".equals(definition.getFieldKey())) {
            return cellNumber(cell, "percentage_completion".equals(definition.getFieldKey())
                    || "over_utilization_pct".equals(definition.getFieldKey()));
        }
        if ("DROPDOWN".equals(dataType)) {
            return matchDropdown(cellRaw(cell), definitionService.parseOptions(definition.getOptionsJson()));
        }
        return cellRaw(cell);
    }

    private String matchDropdown(String raw, List<String> options) {
        if (isBlank(raw) || options == null || options.isEmpty()) {
            return trimToNull(raw);
        }
        String value = raw.trim();
        for (String option : options) {
            if (option.equalsIgnoreCase(value)) {
                return option;
            }
        }
        String normalized = IssueNewRdColumnMap.normalize(value);
        if (options.stream().anyMatch(o -> "Yes".equalsIgnoreCase(o) || "No".equalsIgnoreCase(o))) {
            if (Set.of("y", "yes", "true", "1").contains(normalized)) {
                return firstOption(options, "Yes");
            }
            if (Set.of("n", "no", "false", "0").contains(normalized)) {
                return firstOption(options, "No");
            }
        }
        if (normalized.equals("onhold") || normalized.equals("onholdstatus") || normalized.equals("hold")) {
            String onhold = firstOption(options, "Onhold");
            if (onhold != null) {
                return onhold;
            }
        }
        if (normalized.equals("medium") || normalized.equals("med")) {
            String mid = firstOption(options, "Mid");
            if (mid != null) {
                return mid;
            }
        }
        for (String option : options) {
            if (IssueNewRdColumnMap.normalize(option).equals(normalized)) {
                return option;
            }
        }
        return null;
    }

    private static String firstOption(List<String> options, String wanted) {
        return options.stream().filter(o -> o.equalsIgnoreCase(wanted)).findFirst().orElse(null);
    }

    private static String normalizeQuarter(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        String normalized = IssueNewRdColumnMap.normalize(raw);
        if (normalized.startsWith("q") && normalized.length() >= 2) {
            char q = normalized.charAt(1);
            if (q >= '1' && q <= '4') {
                return "Q" + q;
            }
        }
        if (normalized.length() == 1 && normalized.charAt(0) >= '1' && normalized.charAt(0) <= '4') {
            return "Q" + normalized.charAt(0);
        }
        return raw.trim();
    }

    private static String matchKnown(String raw, Set<String> options) {
        if (isBlank(raw)) {
            return null;
        }
        for (String option : options) {
            if (option.equalsIgnoreCase(raw.trim())) {
                return option;
            }
        }
        String normalized = IssueNewRdColumnMap.normalize(raw);
        for (String option : options) {
            if (IssueNewRdColumnMap.normalize(option).equals(normalized)) {
                return option;
            }
        }
        return raw.trim();
    }

    private static String matchRiskImpact(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        String normalized = IssueNewRdColumnMap.normalize(raw);
        if (normalized.equals("medium") || normalized.equals("med") || normalized.equals("mid")) {
            return "Mid";
        }
        return matchKnown(raw, RISK_IMPACTS);
    }

    private String cellForKind(
            Map<Integer, IssueNewRdColumnMap.Target> columns, Row row, IssueNewRdColumnMap.Kind kind) {
        Cell cell = cellForKindCell(columns, row, kind);
        return cellRaw(cell);
    }

    private Cell cellForKindCell(
            Map<Integer, IssueNewRdColumnMap.Target> columns, Row row, IssueNewRdColumnMap.Kind kind) {
        for (Map.Entry<Integer, IssueNewRdColumnMap.Target> entry : columns.entrySet()) {
            if (entry.getValue().kind() == kind) {
                return row.getCell(entry.getKey());
            }
        }
        return null;
    }

    private LocalDate parseDateValue(String raw, Cell cell) {
        LocalDate fromCell = parseDateCell(cell);
        if (fromCell != null) {
            return fromCell;
        }
        return parseDateString(raw);
    }

    private LocalDate parseDateCell(Cell cell) {
        if (cell == null) {
            return null;
        }
        try {
            if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC
                    || (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.FORMULA
                    && DateUtil.isCellDateFormatted(cell))) {
                if (DateUtil.isCellDateFormatted(cell) || looksLikeExcelDate(cell.getNumericCellValue())) {
                    return cell.getLocalDateTimeCellValue().toLocalDate();
                }
            }
        } catch (Exception ignored) {
            // fall through to string parse
        }
        return parseDateString(cellRaw(cell));
    }

    private static boolean looksLikeExcelDate(double value) {
        return value > 20000 && value < 80000;
    }

    private static LocalDate parseDateString(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        String value = normalizeDateText(raw);
        if (value.contains("T")) {
            value = value.substring(0, value.indexOf('T'));
        }
        for (DateTimeFormatter formatter : DATE_FORMATS) {
            try {
                return LocalDate.parse(value, formatter);
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        return null;
    }

    /** Normalize Excel text dates: 5-Aug-24, 15-Jun-24, 5-Sep-2024, 5/14/2026. */
    private static String normalizeDateText(String raw) {
        String value = raw.trim()
                .replace('\u2013', '-')
                .replace('\u2014', '-')
                .replace('\u2212', '-');
        value = value.replaceAll("\\s*-\\s*", "-");
        value = value.replaceAll("\\s*/\\s*", "/");
        value = value.replaceAll("\\s+", " ").trim();
        return value;
    }

    private static List<DateTimeFormatter> buildDateFormats() {
        List<DateTimeFormatter> formats = new ArrayList<>();
        formats.add(DateTimeFormatter.ISO_LOCAL_DATE);
        formats.add(pattern("M/d/yyyy"));
        formats.add(pattern("MM/dd/yyyy"));
        formats.add(pattern("M-d-yyyy"));
        formats.add(pattern("MM-dd-yyyy"));
        formats.add(pattern("d-MMM-yyyy"));
        formats.add(pattern("dd-MMM-yyyy"));
        formats.add(pattern("d/MMM/yyyy"));
        formats.add(pattern("d MMM yyyy"));
        formats.add(pattern("dd MMM yyyy"));
        formats.add(pattern("MMM d, yyyy"));
        formats.add(pattern("d-MMMM-yyyy"));
        formats.add(reducedYear("M/d/"));
        formats.add(reducedYear("MM/dd/"));
        formats.add(reducedYear("d-MMM-"));
        formats.add(reducedYear("dd-MMM-"));
        formats.add(reducedYear("d/MMM/"));
        formats.add(reducedYear("d MMM "));
        return List.copyOf(formats);
    }

    private static DateTimeFormatter pattern(String pattern) {
        return new DateTimeFormatterBuilder()
                .parseCaseInsensitive()
                .parseLenient()
                .appendPattern(pattern)
                .toFormatter(Locale.ENGLISH);
    }

    /** Two-digit years such as 24 → 2024. */
    private static DateTimeFormatter reducedYear(String prefix) {
        return new DateTimeFormatterBuilder()
                .parseCaseInsensitive()
                .parseLenient()
                .appendPattern(prefix)
                .appendValueReduced(ChronoField.YEAR, 2, 2, 2000)
                .toFormatter(Locale.ENGLISH);
    }

    private static String extractYear(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() >= 4) {
            String year = digits.substring(0, 4);
            try {
                int n = Integer.parseInt(year);
                if (n >= 1900 && n <= 2100) {
                    return year;
                }
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String cellNumber(Cell cell, boolean percent) {
        if (cell == null) {
            return null;
        }
        try {
            if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC) {
                double val = cell.getNumericCellValue();
                if (percent && val > 0 && val <= 1) {
                    val = val * 100;
                }
                return BigDecimal.valueOf(val).stripTrailingZeros().toPlainString();
            }
        } catch (Exception ignored) {
            // fall through
        }
        String raw = cellRaw(cell);
        if (raw == null) {
            return null;
        }
        String cleaned = raw.replace("%", "").replace(",", "").trim();
        if (cleaned.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(cleaned).stripTrailingZeros().toPlainString();
        } catch (NumberFormatException e) {
            return cleaned;
        }
    }

    private String cellRaw(Cell cell) {
        if (cell == null) {
            return null;
        }
        return switch (cell.getCellType()) {
            case STRING -> trimToNull(cell.getStringCellValue());
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val) && !Double.isInfinite(val)) {
                    yield String.valueOf((long) val);
                }
                yield BigDecimal.valueOf(val).stripTrailingZeros().toPlainString();
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield trimToNull(cell.getStringCellValue());
                } catch (Exception e) {
                    try {
                        yield BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
                    } catch (Exception ignored) {
                        yield null;
                    }
                }
            }
            default -> null;
        };
    }

    private static List<String> readHeaderLabels(Row header) {
        List<String> headers = new ArrayList<>();
        short last = header.getLastCellNum();
        for (int i = 0; i < last; i++) {
            Cell cell = header.getCell(i);
            if (cell == null) {
                continue;
            }
            String value = switch (cell.getCellType()) {
                case STRING -> trimToNull(cell.getStringCellValue());
                default -> null;
            };
            if (value != null) {
                headers.add(value);
            }
        }
        return headers;
    }

    private Map<String, IssueType> indexIssueTypesByWorkflowCode() {
        Map<String, IssueType> byCode = new HashMap<>();
        for (IssueType issueType : IssueTypeCatalog.filterAndSort(issueTypeRepository.findAll())) {
            byCode.put(issueType.getWorkflowCode().toUpperCase(Locale.ROOT), issueType);
        }
        return byCode;
    }

    private Map<String, Priority> indexPrioritiesByLabel() {
        Map<String, Priority> byLabel = new HashMap<>();
        for (Priority priority : priorityRepository.findAllByOrderByLevelAsc()) {
            byLabel.put(IssueNewRdColumnMap.normalize(priority.getLabel()), priority);
        }
        return byLabel;
    }

    private Map<String, IssueStatus> indexStatusesByName() {
        Map<String, IssueStatus> byName = new HashMap<>();
        for (IssueStatus status : issueStatusRepository.findAllByOrderBySequenceAsc()) {
            byName.put(IssueNewRdColumnMap.normalize(status.getName()), status);
        }
        return byName;
    }

    private static String rowMessage(String sheet, int rowNumber, String message) {
        return sheet + " row " + rowNumber + ": " + message;
    }

    private static String rootMessage(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        String message = current.getMessage();
        return message != null && !message.isBlank() ? message : ex.getClass().getSimpleName();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return trimToNull(value) == null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty() || isUnsetToken(trimmed)) {
            return null;
        }
        return trimmed;
    }

    /** Excel placeholders that mean "no value" — leave the system field empty. */
    private static boolean isUnsetToken(String value) {
        String normalized = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
        return "na".equals(normalized) || "tobefound".equals(normalized) || "tbd".equals(normalized);
    }

    private record LookupResult<T>(T value, String error) {
        static <T> LookupResult<T> ok(T value) {
            return new LookupResult<>(value, null);
        }

        static <T> LookupResult<T> fail(String error) {
            return new LookupResult<>(null, error);
        }
    }

    private static final class ImportCounters {
        private int created;
        private int updated;
    }
}
