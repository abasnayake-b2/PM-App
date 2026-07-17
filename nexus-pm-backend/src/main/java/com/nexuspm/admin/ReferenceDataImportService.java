package com.nexuspm.admin;

import com.nexuspm.admin.dto.ReferenceDataImportResult;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.util.ExcelUploadValidator;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.entity.Designation;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Skill;
import com.nexuspm.user.entity.Stream;
import com.nexuspm.user.repository.DepartmentRepository;
import com.nexuspm.user.repository.DesignationRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.SkillRepository;
import com.nexuspm.user.repository.StreamRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReferenceDataImportService {

    private final DepartmentRepository departmentRepository;
    private final StreamRepository streamRepository;
    private final DesignationRepository designationRepository;
    private final SkillRepository skillRepository;
    private final EmployeeRepository employeeRepository;
    private final DfnPmProperties properties;

    @Transactional
    public ReferenceDataImportResult importExcel(MultipartFile file) {
        ExcelUploadValidator.validate(file, properties);

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx";
        String importedByName = resolveImporterName();

        ImportStats departments = new ImportStats();
        ImportStats streams = new ImportStats();
        ImportStats designations = new ImportStats();
        ImportStats skills = new ImportStats();
        List<String> errors = new ArrayList<>();

        Map<String, Department> departmentByName = indexDepartments();
        Map<String, Stream> streamByName = indexStreams();
        Map<String, Designation> designationByName = indexDesignations();
        Map<String, Skill> skillByName = indexSkills();

        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            importDepartmentsSheet(workbook, departmentByName, departments, errors);
            importStreamsSheet(workbook, departmentByName, streamByName, streams, errors);
            importDesignationsSheet(workbook, departmentByName, streamByName, designationByName, designations, errors);
            importSkillsSheet(workbook, skillByName, skills, errors, false);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("IMPORT_FAILED", "Failed to read Excel file: " + ex.getMessage(), 400);
        }

        return ReferenceDataImportResult.builder()
                .fileName(fileName)
                .departmentsCreated(departments.created)
                .departmentsUpdated(departments.updated)
                .departmentsSkipped(departments.skipped)
                .streamsCreated(streams.created)
                .streamsUpdated(streams.updated)
                .streamsSkipped(streams.skipped)
                .designationsCreated(designations.created)
                .designationsUpdated(designations.updated)
                .designationsSkipped(designations.skipped)
                .skillsCreated(skills.created)
                .skillsUpdated(skills.updated)
                .skillsSkipped(skills.skipped)
                .errors(errors)
                .importedByName(importedByName)
                .importedAt(Instant.now())
                .build();
    }

    @Transactional
    public ReferenceDataImportResult importSkillsExcel(MultipartFile file) {
        ExcelUploadValidator.validate(file, properties);

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx";
        String importedByName = resolveImporterName();
        ImportStats skills = new ImportStats();
        List<String> errors = new ArrayList<>();
        Map<String, Skill> skillByName = indexSkills();

        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            importSkillsSheet(workbook, skillByName, skills, errors, true);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("IMPORT_FAILED", "Failed to read Excel file: " + ex.getMessage(), 400);
        }

        return ReferenceDataImportResult.builder()
                .fileName(fileName)
                .skillsCreated(skills.created)
                .skillsUpdated(skills.updated)
                .skillsSkipped(skills.skipped)
                .errors(errors)
                .importedByName(importedByName)
                .importedAt(Instant.now())
                .build();
    }

    private void importSkillsSheet(
            Workbook workbook,
            Map<String, Skill> skillByName,
            ImportStats stats,
            List<String> errors,
            boolean required) {
        Sheet sheet = resolveSheet(workbook, "Skills", "Skill");
        if (sheet == null) {
            if (required) {
                throw new BusinessException("IMPORT_FAILED", "Skills sheet is required", 400);
            }
            return;
        }
        Row header = sheet.getRow(0);
        if (header == null) {
            if (required) {
                throw new BusinessException("IMPORT_FAILED", "Skills sheet header row is missing", 400);
            }
            return;
        }
        Map<String, Integer> columns = parseHeader(header);
        if (!columns.containsKey("skillname")
                && !columns.containsKey("skill")
                && !columns.containsKey("name")) {
            String message = "Skills sheet requires a Name (or Skill / Skill Name) column";
            if (required) {
                throw new BusinessException("IMPORT_FAILED", message, 400);
            }
            errors.add(message);
            return;
        }

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) {
                continue;
            }
            String name = firstCell(row, columns, "skillname", "skill", "name");
            if (isBlank(name)) {
                continue;
            }
            boolean hasDescriptionColumn = columns.containsKey("description")
                    || columns.containsKey("skilldescription")
                    || columns.containsKey("desc");
            String description = hasDescriptionColumn
                    ? trimOrNull(firstCell(row, columns, "description", "skilldescription", "desc"))
                    : null;
            String key = normalizeNameKey(name);
            Skill existing = skillByName.get(key);
            if (existing == null) {
                Skill skill = new Skill();
                skill.setId(UUID.randomUUID());
                skill.setName(name.trim());
                skill.setDescription(description);
                skillRepository.save(skill);
                skillByName.put(key, skill);
                stats.created++;
            } else {
                boolean changed = false;
                String trimmedName = name.trim();
                if (!existing.getName().equals(trimmedName)) {
                    existing.setName(trimmedName);
                    changed = true;
                }
                if (hasDescriptionColumn && !Objects.equals(existing.getDescription(), description)) {
                    existing.setDescription(description);
                    changed = true;
                }
                if (changed) {
                    skillRepository.save(existing);
                    stats.updated++;
                } else {
                    stats.skipped++;
                }
            }
        }
    }

    private Map<String, Skill> indexSkills() {
        Map<String, Skill> byName = new HashMap<>();
        for (Skill skill : skillRepository.findAll()) {
            byName.put(normalizeNameKey(skill.getName()), skill);
        }
        return byName;
    }

    private Sheet resolveSheet(Workbook workbook, String... names) {
        for (String name : names) {
            Sheet sheet = workbook.getSheet(name);
            if (sheet != null) {
                return sheet;
            }
        }
        if (workbook.getNumberOfSheets() == 1) {
            return workbook.getSheetAt(0);
        }
        return null;
    }

    private void importDepartmentsSheet(
            Workbook workbook,
            Map<String, Department> departmentByName,
            ImportStats stats,
            List<String> errors) {
        Sheet sheet = workbook.getSheet("Departments");
        if (sheet == null) {
            throw new BusinessException("IMPORT_FAILED", "Departments sheet is required", 400);
        }
        Row header = sheet.getRow(0);
        if (header == null) {
            throw new BusinessException("IMPORT_FAILED", "Departments sheet header row is missing", 400);
        }
        Map<String, Integer> columns = parseHeader(header);
        if (!columns.containsKey("departmentname") && !columns.containsKey("name")) {
            throw new BusinessException("IMPORT_FAILED", "Departments sheet requires a Department Name column", 400);
        }

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) {
                continue;
            }
            String name = firstCell(row, columns, "departmentname", "name");
            if (isBlank(name)) {
                continue;
            }
            String key = normalizeNameKey(name);
            Department existing = departmentByName.get(key);
            if (existing == null) {
                Department department = new Department();
                department.setId(UUID.randomUUID());
                department.setName(name.trim());
                departmentRepository.save(department);
                departmentByName.put(key, department);
                stats.created++;
            } else if (!existing.getName().equals(name.trim())) {
                existing.setName(name.trim());
                departmentRepository.save(existing);
                stats.updated++;
            } else {
                stats.skipped++;
            }
        }
    }

    private void importStreamsSheet(
            Workbook workbook,
            Map<String, Department> departmentByName,
            Map<String, Stream> streamByName,
            ImportStats stats,
            List<String> errors) {
        Sheet sheet = workbook.getSheet("Streams");
        if (sheet == null) {
            throw new BusinessException("IMPORT_FAILED", "Streams sheet is required", 400);
        }
        Row header = sheet.getRow(0);
        if (header == null) {
            throw new BusinessException("IMPORT_FAILED", "Streams sheet header row is missing", 400);
        }
        Map<String, Integer> columns = parseHeader(header);
        if (!columns.containsKey("streams") && !columns.containsKey("stream")) {
            throw new BusinessException("IMPORT_FAILED", "Streams sheet requires a Streams column", 400);
        }
        if (!columns.containsKey("departmentname")) {
            throw new BusinessException("IMPORT_FAILED", "Streams sheet requires a Department Name column", 400);
        }

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) {
                continue;
            }
            String streamName = firstCell(row, columns, "streams", "stream");
            String departmentName = cell(row, columns, "departmentname");
            if (isBlank(streamName) && isBlank(departmentName)) {
                continue;
            }
            if (isBlank(streamName) || isBlank(departmentName)) {
                errors.add(rowMessage("Streams", rowIdx + 1, "Department Name and Streams are required"));
                stats.skipped++;
                continue;
            }

            Department department = departmentByName.get(normalizeNameKey(departmentName));
            if (department == null) {
                errors.add(rowMessage("Streams", rowIdx + 1, "Department not found: " + departmentName.trim()));
                stats.skipped++;
                continue;
            }

            String trimmedStream = streamName.trim();
            String key = normalizeNameKey(trimmedStream);
            Stream existing = streamByName.get(key);
            if (existing == null) {
                Stream stream = new Stream();
                stream.setId(UUID.randomUUID());
                stream.setName(trimmedStream);
                stream.setDepartment(department);
                streamRepository.save(stream);
                streamByName.put(key, stream);
                stats.created++;
            } else {
                boolean changed = false;
                if (!existing.getName().equals(trimmedStream)) {
                    existing.setName(trimmedStream);
                    changed = true;
                }
                if (existing.getDepartment() == null
                        || !existing.getDepartment().getId().equals(department.getId())) {
                    existing.setDepartment(department);
                    changed = true;
                }
                if (changed) {
                    streamRepository.save(existing);
                    stats.updated++;
                } else {
                    stats.skipped++;
                }
            }
        }
    }

    private void importDesignationsSheet(
            Workbook workbook,
            Map<String, Department> departmentByName,
            Map<String, Stream> streamByName,
            Map<String, Designation> designationByName,
            ImportStats stats,
            List<String> errors) {
        Sheet sheet = workbook.getSheet("Designations");
        if (sheet == null) {
            throw new BusinessException("IMPORT_FAILED", "Designations sheet is required", 400);
        }
        Row header = sheet.getRow(0);
        if (header == null) {
            throw new BusinessException("IMPORT_FAILED", "Designations sheet header row is missing", 400);
        }
        Map<String, Integer> columns = parseHeader(header);
        if (!columns.containsKey("designation")) {
            throw new BusinessException("IMPORT_FAILED", "Designations sheet requires a Designation column", 400);
        }

        Set<String> seenInFile = new HashSet<>();

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) {
                continue;
            }
            String designationName = cell(row, columns, "designation");
            String departmentName = cell(row, columns, "departmentname");
            String streamName = firstCell(row, columns, "streams", "stream");
            String roleCode = firstCell(row, columns, "rolecode", "code");
            if (isBlank(designationName) && isBlank(roleCode)) {
                continue;
            }
            if (isBlank(designationName)) {
                errors.add(rowMessage("Designations", rowIdx + 1, "Designation is required"));
                stats.skipped++;
                continue;
            }

            String trimmedName = designationName.trim();
            String nameKey = normalizeNameKey(trimmedName);
            if (!seenInFile.add(nameKey)) {
                stats.skipped++;
                continue;
            }

            String normalizedCode = normalizeCode(roleCode);
            Department department = resolveDepartment(departmentName, departmentByName, streamName, streamByName);
            Stream stream = resolveStream(streamName, streamByName);

            if (department == null && stream != null) {
                department = stream.getDepartment();
            }
            if (department == null) {
                errors.add(rowMessage("Designations", rowIdx + 1, "Department not found for designation: " + trimmedName));
                stats.skipped++;
                continue;
            }
            if (stream == null && !isBlank(streamName)) {
                errors.add(rowMessage("Designations", rowIdx + 1, "Stream not found: " + streamName.trim()));
                stats.skipped++;
                continue;
            }

            Designation existing = designationByName.get(nameKey);
            if (existing == null && normalizedCode != null) {
                existing = designationRepository.findByCodeIgnoreCase(normalizedCode).orElse(null);
            }

            if (existing == null) {
                if (normalizedCode != null && designationRepository.existsByCodeIgnoreCase(normalizedCode)) {
                    errors.add(rowMessage("Designations", rowIdx + 1,
                            "Role code already used by another designation: " + normalizedCode));
                    stats.skipped++;
                    continue;
                }
                Designation designation = new Designation();
                designation.setId(UUID.randomUUID());
                designation.setName(trimmedName);
                designation.setCode(normalizedCode);
                designation.setDepartment(department);
                designation.setStream(stream);
                designationRepository.save(designation);
                designationByName.put(nameKey, designation);
                stats.created++;
                continue;
            }

            if (normalizedCode != null
                    && designationRepository.existsByCodeIgnoreCaseAndIdNot(normalizedCode, existing.getId())) {
                errors.add(rowMessage("Designations", rowIdx + 1,
                        "Role code already used by another designation: " + normalizedCode));
                stats.skipped++;
                continue;
            }

            boolean changed = false;
            if (!existing.getName().equals(trimmedName)) {
                existing.setName(trimmedName);
                changed = true;
            }
            if (!Objects.equals(existing.getCode(), normalizedCode)) {
                existing.setCode(normalizedCode);
                changed = true;
            }
            if (existing.getDepartment() == null || !existing.getDepartment().getId().equals(department.getId())) {
                existing.setDepartment(department);
                changed = true;
            }
            UUID existingStreamId = existing.getStream() != null ? existing.getStream().getId() : null;
            UUID newStreamId = stream != null ? stream.getId() : null;
            if (!Objects.equals(existingStreamId, newStreamId)) {
                existing.setStream(stream);
                changed = true;
            }

            if (changed) {
                designationRepository.save(existing);
                designationByName.put(nameKey, existing);
                stats.updated++;
            } else {
                stats.skipped++;
            }
        }
    }

    private Department resolveDepartment(
            String departmentName,
            Map<String, Department> departmentByName,
            String streamName,
            Map<String, Stream> streamByName) {
        if (!isBlank(departmentName)) {
            return departmentByName.get(normalizeNameKey(departmentName));
        }
        if (!isBlank(streamName)) {
            Stream stream = streamByName.get(normalizeNameKey(streamName));
            return stream != null ? stream.getDepartment() : null;
        }
        return null;
    }

    private Stream resolveStream(String streamName, Map<String, Stream> streamByName) {
        if (isBlank(streamName)) {
            return null;
        }
        return streamByName.get(normalizeNameKey(streamName));
    }

    private String resolveImporterName() {
        UUID userId = SecurityUtils.currentUserId();
        if (userId == null) {
            return null;
        }
        return employeeRepository.findById(userId).map(Employee::getFullName).orElse(null);
    }

    private Map<String, Department> indexDepartments() {
        Map<String, Department> byName = new HashMap<>();
        for (Department department : departmentRepository.findAll()) {
            byName.put(normalizeNameKey(department.getName()), department);
        }
        return byName;
    }

    private Map<String, Stream> indexStreams() {
        Map<String, Stream> byName = new HashMap<>();
        for (Stream stream : streamRepository.findAll()) {
            byName.put(normalizeNameKey(stream.getName()), stream);
        }
        return byName;
    }

    private Map<String, Designation> indexDesignations() {
        Map<String, Designation> byName = new HashMap<>();
        for (Designation designation : designationRepository.findAll()) {
            byName.put(normalizeNameKey(designation.getName()), designation);
        }
        return byName;
    }

    private static Map<String, Integer> parseHeader(Row header) {
        Map<String, Integer> columns = new HashMap<>();
        for (Cell cell : header) {
            String value = trimOrNull(cellString(cell));
            if (value == null) {
                continue;
            }
            columns.put(normalizeHeader(value), cell.getColumnIndex());
        }
        return columns;
    }

    private static String cell(Row row, Map<String, Integer> columns, String key) {
        Integer idx = columns.get(key);
        if (idx == null) {
            return null;
        }
        return trimOrNull(cellString(row.getCell(idx)));
    }

    private static String firstCell(Row row, Map<String, Integer> columns, String... keys) {
        for (String key : keys) {
            String value = cell(row, columns, key);
            if (!isBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private static String normalizeHeader(String header) {
        return header.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private static String normalizeNameKey(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String rowMessage(String sheet, int rowNumber, String message) {
        return sheet + " row " + rowNumber + ": " + message;
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

    private static final class ImportStats {
        private int created;
        private int updated;
        private int skipped;
    }
}
