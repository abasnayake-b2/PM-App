package com.nexuspm.issue;

import com.nexuspm.issue.dto.IssueImportResult;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.lookup.IssueTypeCatalog;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.util.ExcelUploadValidator;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class IssueImportService {

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
            Map.entry("cr", "CHANGE"));

    private final RdIssueRepository issueRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final IssueTypeRepository issueTypeRepository;
    private final PriorityRepository priorityRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditLogService auditLogService;
    private final IssueKeyAllocator issueKeyAllocator;
    private final com.nexuspm.shared.config.DfnPmProperties properties;

    @Transactional
    public IssueImportResult importBacklogExcel(MultipartFile file, UUID scopedProjectId) {
        ExcelUploadValidator.validate(file, properties);
        if (scopedProjectId != null) {
            projectService.getProject(scopedProjectId);
        } else if (!SecurityUtils.isAdmin()) {
            throw new BusinessException("ACCESS_DENIED", "Only admins can import backlog for all projects", 403);
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

        int skipped = 0;
        List<String> errors = new ArrayList<>();
        ImportCounters counters = new ImportCounters();

        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = resolveSheet(workbook);
            Row header = sheet.getRow(0);
            if (header == null) {
                throw new BusinessException("IMPORT_FAILED", "Header row is missing", 400);
            }
            Map<String, Integer> columns = parseHeader(header);

            for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row == null) {
                    continue;
                }

                String title = cell(row, columns, "title");
                if (isBlank(title)) {
                    continue;
                }

                String rowError = importRow(
                        scopedProjectId,
                        row,
                        columns,
                        title,
                        issueTypesByCode,
                        prioritiesByLabel,
                        statusesByName,
                        defaultStatus,
                        importer,
                        importerId,
                        counters);
                if (rowError != null) {
                    errors.add(rowError);
                    skipped++;
                }
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
                .importedByName(importer.getFullName())
                .importedAt(Instant.now())
                .build();
    }

    private String importRow(
            UUID scopedProjectId,
            Row row,
            Map<String, Integer> columns,
            String title,
            Map<String, IssueType> issueTypesByCode,
            Map<String, Priority> prioritiesByLabel,
            Map<String, IssueStatus> statusesByName,
            IssueStatus defaultStatus,
            Employee importer,
            UUID importerId,
            ImportCounters counters) {
        LookupResult<Project> projectResult = lookupProject(scopedProjectId, cell(row, columns, "project"));
        if (projectResult.error() != null) {
            return rowMessage(row.getRowNum() + 1, projectResult.error());
        }

        LookupResult<IssueType> typeResult = lookupIssueType(issueTypesByCode, cell(row, columns, "type"));
        if (typeResult.error() != null) {
            return rowMessage(row.getRowNum() + 1, typeResult.error());
        }

        LookupResult<Priority> priorityResult = lookupPriority(
                prioritiesByLabel,
                cell(row, columns, "priority2"),
                cell(row, columns, "priority"));
        if (priorityResult.error() != null) {
            return rowMessage(row.getRowNum() + 1, priorityResult.error());
        }

        LookupResult<IssueStatus> statusResult = lookupStatus(
                statusesByName, cell(row, columns, "currentstage"), defaultStatus);
        if (statusResult.error() != null) {
            return rowMessage(row.getRowNum() + 1, statusResult.error());
        }

        Project project = projectResult.value();
        IssueType issueType = typeResult.value();
        Priority priority = priorityResult.value();
        IssueStatus status = statusResult.value();

        Optional<RdIssue> existing = issueRepository.findByProjectIdAndTitleIgnoreCaseAndDeletedFalse(
                project.getId(), title.trim());
        if (existing.isPresent()) {
            RdIssue issue = existing.get();
            issue.setIssueType(issueType);
            issue.setPriority(priority);
            issue.setStatus(status);
            if (!status.isTerminal() && priority.getSlaResolveHrs() != null) {
                issue.setSlaDueAt(issue.getCreatedAt().plus(priority.getSlaResolveHrs(), ChronoUnit.HOURS));
            }
            if (issue.getDisplayKey() == null || issue.getDisplayKey().isBlank()) {
                issueKeyAllocator.assign(issue, project, issue.getParentIssue(), issueType.getWorkflowCode());
            }
            issueRepository.save(issue);
            counters.updated++;
            return null;
        }

        RdIssue issue = new RdIssue();
        issue.setId(UUID.randomUUID());
        issue.setProject(project);
        issue.setTitle(title.trim());
        issue.setIssueType(issueType);
        issue.setPriority(priority);
        issue.setStatus(status);
        issue.setReportedBy(importer);
        issue.setSlaDueAt(Instant.now().plus(priority.getSlaResolveHrs(), ChronoUnit.HOURS));
        issue.setSlaStatus("WITHIN");
        issueKeyAllocator.assign(issue, project, null, issueType.getWorkflowCode());
        issueRepository.save(issue);
        auditLogService.log(importerId, "CREATE", "ISSUE", issue.getId(), issue.getTitle(), "RD import");
        counters.created++;
        return null;
    }

    private LookupResult<Project> lookupProject(UUID scopedProjectId, String projectKey) {
        if (scopedProjectId != null) {
            return projectRepository.findById(scopedProjectId)
                    .filter(project -> !project.isDeleted())
                    .map(LookupResult::ok)
                    .orElse(LookupResult.fail("Project not found"));
        }

        if (isBlank(projectKey)) {
            return LookupResult.fail("Project column is required");
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

    private LookupResult<IssueType> lookupIssueType(Map<String, IssueType> issueTypesByCode, String rawType) {
        if (isBlank(rawType)) {
            return LookupResult.fail("Type is required");
        }
        String workflowCode = TYPE_TO_WORKFLOW.get(normalizeToken(rawType));
        if (workflowCode == null) {
            return LookupResult.fail("Unsupported type: " + rawType.trim());
        }
        IssueType issueType = issueTypesByCode.get(workflowCode);
        if (issueType == null) {
            return LookupResult.fail("Issue type not configured: " + workflowCode);
        }
        return LookupResult.ok(issueType);
    }

    private LookupResult<Priority> lookupPriority(
            Map<String, Priority> prioritiesByLabel, String primary, String fallback) {
        String label = !isBlank(primary) ? primary : fallback;
        if (isBlank(label)) {
            return LookupResult.fail("Priority is required");
        }
        Priority priority = prioritiesByLabel.get(normalizeToken(label));
        if (priority == null) {
            return LookupResult.fail("Unknown priority: " + label.trim());
        }
        return LookupResult.ok(priority);
    }

    private LookupResult<IssueStatus> lookupStatus(
            Map<String, IssueStatus> statusesByName, String rawStage, IssueStatus defaultStatus) {
        if (isBlank(rawStage)) {
            return LookupResult.ok(defaultStatus);
        }
        IssueStatus matched = statusesByName.get(normalizeToken(rawStage));
        if (matched != null) {
            return LookupResult.ok(matched);
        }
        return LookupResult.fail("Unknown current stage: " + rawStage.trim());
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
            byLabel.put(normalizeToken(priority.getLabel()), priority);
        }
        return byLabel;
    }

    private Map<String, IssueStatus> indexStatusesByName() {
        Map<String, IssueStatus> byName = new HashMap<>();
        for (IssueStatus status : issueStatusRepository.findAllByOrderBySequenceAsc()) {
            byName.put(normalizeToken(status.getName()), status);
        }
        return byName;
    }

    private Map<String, Integer> parseHeader(Row header) {
        Map<String, Integer> columns = new HashMap<>();
        for (Cell cell : header) {
            String value = trimOrNull(cellString(cell));
            if (value == null) {
                continue;
            }
            String normalized = normalizeHeader(value);
            if ("priority".equals(normalized)) {
                if (columns.containsKey("priority")) {
                    columns.put("priority2", cell.getColumnIndex());
                } else {
                    columns.put("priority", cell.getColumnIndex());
                }
                continue;
            }
            if ("currentstage".equals(normalized) || "stage".equals(normalized)) {
                columns.put("currentstage", cell.getColumnIndex());
                continue;
            }
            columns.put(normalized, cell.getColumnIndex());
        }
        if (!columns.containsKey("title") || !columns.containsKey("type")) {
            throw new BusinessException(
                    "IMPORT_FAILED",
                    "Expected columns: Project, Title, Type, Priority, Current Stage",
                    400);
        }
        return columns;
    }

    private String cell(Row row, Map<String, Integer> columns, String key) {
        Integer idx = columns.get(key);
        if (idx == null) {
            return null;
        }
        return trimOrNull(cellString(row.getCell(idx)));
    }

    private static Sheet resolveSheet(Workbook workbook) {
        Sheet sheet = workbook.getSheet("RD");
        if (sheet == null) {
            sheet = workbook.getSheet("Backlog");
        }
        if (sheet == null && workbook.getNumberOfSheets() > 0) {
            sheet = workbook.getSheetAt(0);
        }
        if (sheet == null) {
            throw new BusinessException("IMPORT_FAILED", "No worksheet found in workbook", 400);
        }
        return sheet;
    }

    private static String normalizeHeader(String header) {
        return header.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private static String normalizeToken(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private static String rowMessage(int rowNumber, String message) {
        return "Row " + rowNumber + ": " + message;
    }

    private static String cellString(Cell cell) {
        if (cell == null) {
            return null;
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toString();
                }
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val)) {
                    yield String.valueOf((long) val);
                }
                yield String.valueOf(val);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue();
                } catch (Exception e) {
                    yield String.valueOf(cell.getNumericCellValue());
                }
            }
            default -> null;
        };
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
