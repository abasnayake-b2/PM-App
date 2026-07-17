package com.nexuspm.project;

import com.nexuspm.organisation.entity.Client;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.organisation.entity.Region;
import com.nexuspm.organisation.repository.ClientRepository;
import com.nexuspm.organisation.repository.CountryRepository;
import com.nexuspm.organisation.repository.RegionRepository;
import com.nexuspm.project.dto.CreateProjectRequest;
import com.nexuspm.project.dto.ProjectImportResult;
import com.nexuspm.project.dto.UpdateProjectRequest;
import com.nexuspm.project.entity.Project;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.util.ExcelUploadValidator;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.repository.EmployeeRepository;
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
public class ProjectImportService {

    private final ProjectService projectService;
    private final ProjectRepository projectRepository;
    private final RegionRepository regionRepository;
    private final CountryRepository countryRepository;
    private final ClientRepository clientRepository;
    private final TeamManagementRepository teamManagementRepository;
    private final EmployeeRepository employeeRepository;
    private final com.nexuspm.shared.config.DfnPmProperties properties;

    @Transactional
    public ProjectImportResult importProjectsExcel(MultipartFile file) {
        if (!SecurityUtils.isAdmin()) {
            throw new BusinessException("ACCESS_DENIED", "Only admins can import projects", 403);
        }
        ExcelUploadValidator.validate(file, properties);

        UUID importerId = SecurityUtils.currentUserId();
        if (importerId == null) {
            throw new BusinessException("ACCESS_DENIED", "Authenticated user required", 403);
        }
        Employee importer = employeeRepository.findById(importerId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Current user not found", 404));

        Map<String, TeamManagement> managementByName = indexManagementByName();
        int created = 0;
        int updated = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = resolveSheet(workbook);
            Row header = sheet.getRow(0);
            if (header == null) {
                throw new BusinessException("IMPORT_FAILED", "Header row is missing", 400);
            }
            Map<String, Integer> columns = parseHeader(header);

            for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                Row row = sheet.getRow(rowIdx);
                if (row == null) continue;

                String projectName = cell(row, columns, "project");
                String clientName = cell(row, columns, "client");
                if (isBlank(projectName) && isBlank(clientName)) continue;
                if (isBlank(projectName) || isBlank(clientName)) {
                    errors.add(rowMessage(rowIdx + 1, "Project and Client are required"));
                    skipped++;
                    continue;
                }

                try {
                    String regionName = cell(row, columns, "region");
                    String countryName = cell(row, columns, "country");
                    String emName = cell(row, columns, "em");
                    String tlName = cell(row, columns, "tl");
                    String product = cell(row, columns, "product");

                    Client client = resolveClient(regionName, countryName, clientName.trim());
                    TeamManagement em = resolveManagement(managementByName, emName, "EM");
                    Employee lead = resolveLead(tlName, importer);

                    Optional<Project> existing = projectRepository.findByClientIdAndNameIgnoreCase(
                            client.getId(), projectName.trim());
                    if (existing.isPresent()) {
                        updateExistingProject(existing.get(), projectName.trim(), product, lead, em);
                        updated++;
                    } else {
                        createNewProject(client, projectName.trim(), product, lead, em);
                        created++;
                    }
                } catch (BusinessException ex) {
                    errors.add(rowMessage(rowIdx + 1, ex.getMessage()));
                    skipped++;
                } catch (Exception ex) {
                    errors.add(rowMessage(rowIdx + 1, ex.getMessage()));
                    skipped++;
                }
            }
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("IMPORT_FAILED", "Failed to read Excel file: " + ex.getMessage(), 400);
        }

        return ProjectImportResult.builder()
                .fileName(file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx")
                .created(created)
                .updated(updated)
                .skipped(skipped)
                .errors(errors)
                .importedByName(importer.getFullName())
                .importedAt(Instant.now())
                .build();
    }

    private void createNewProject(Client client, String projectName, String product, Employee lead,
            TeamManagement em) {
        CreateProjectRequest request = new CreateProjectRequest();
        request.setClientId(client.getId());
        request.setName(projectName);
        request.setProduct(product);
        request.setLeadEmployeeId(lead.getId());
        // VP is derived from EM's supervisor — import only assigns EM
        if (em != null) {
            request.setEngineeringManagerManagementId(em.getId());
        }
        projectService.createProject(request);
    }

    private void updateExistingProject(Project project, String projectName, String product, Employee lead,
            TeamManagement em) {
        UpdateProjectRequest request = new UpdateProjectRequest();
        request.setName(projectName);
        request.setProduct(product);
        request.setLeadEmployeeId(lead.getId());
        request.setEngineeringManagerManagementId(em != null ? em.getId() : null);
        projectService.updateProject(project.getId(), request);
    }

    private Client resolveClient(String regionName, String countryName, String clientName) {
        if (isBlank(regionName) || isBlank(countryName)) {
            throw new BusinessException("IMPORT_VALIDATION", "Region and Country are required", 400);
        }
        Region region = regionRepository.findByNameIgnoreCase(regionName.trim())
                .orElseGet(() -> createRegion(regionName.trim()));
        Country country = countryRepository.findByRegionIdAndNameIgnoreCase(region.getId(), countryName.trim())
                .orElseGet(() -> createCountry(region, countryName.trim()));
        return clientRepository.findByCountryIdAndNameIgnoreCase(country.getId(), clientName)
                .orElseGet(() -> createClient(country, clientName));
    }

    private Region createRegion(String name) {
        Region region = new Region();
        region.setId(UUID.randomUUID());
        region.setName(name);
        region.setCode(regionCodeFromName(name));
        if (regionRepository.existsByCode(region.getCode())) {
            region.setCode(region.getCode() + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase());
        }
        return regionRepository.save(region);
    }

    private Country createCountry(Region region, String name) {
        Country country = new Country();
        country.setId(UUID.randomUUID());
        country.setRegion(region);
        country.setName(name);
        country.setCode(name.length() <= 10 ? name.toUpperCase(Locale.ROOT) : regionCodeFromName(name));
        return countryRepository.save(country);
    }

    private Client createClient(Country country, String name) {
        Client client = new Client();
        client.setId(UUID.randomUUID());
        client.setCountry(country);
        client.setName(name);
        client.setStatus("ACTIVE");
        return clientRepository.save(client);
    }

    private TeamManagement resolveManagement(Map<String, TeamManagement> byName, String name, String label) {
        if (isBlank(name)) {
            return null;
        }
        TeamManagement match = byName.get(normalizeNameKey(name));
        if (match == null) {
            throw new BusinessException(
                    "IMPORT_VALIDATION",
                    label + " not found in management roster: " + name.trim(),
                    400);
        }
        return match;
    }

    private Employee resolveLead(String tlName, Employee fallback) {
        if (isBlank(tlName)) {
            return fallback;
        }
        return employeeRepository.findByFullNameIgnoreCase(tlName.trim())
                .orElseThrow(() -> new BusinessException(
                        "IMPORT_VALIDATION",
                        "Tech lead not found in employee roster: " + tlName.trim(),
                        400));
    }

    private Map<String, TeamManagement> indexManagementByName() {
        Map<String, TeamManagement> byName = new HashMap<>();
        for (TeamManagement management : teamManagementRepository.findAll()) {
            byName.put(normalizeNameKey(management.getFullName()), management);
        }
        return byName;
    }

    private Map<String, Integer> parseHeader(Row header) {
        Map<String, Integer> columns = new HashMap<>();
        for (Cell cell : header) {
            String value = trimOrNull(cellString(cell));
            if (value == null) continue;
            columns.put(normalizeHeader(value), cell.getColumnIndex());
        }
        if (!columns.containsKey("project") || !columns.containsKey("client")) {
            throw new BusinessException(
                    "IMPORT_FAILED",
                    "Expected columns: Region, Country, Client, Project, Product, EM, TL",
                    400);
        }
        return columns;
    }

    private String cell(Row row, Map<String, Integer> columns, String key) {
        Integer idx = columns.get(key);
        if (idx == null) return null;
        return trimOrNull(cellString(row.getCell(idx)));
    }

    private static Sheet resolveSheet(Workbook workbook) {
        Sheet sheet = workbook.getSheet("Projects");
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

    private static String regionCodeFromName(String name) {
        String[] words = name.trim().split("\\s+");
        if (words.length == 1) {
            String word = words[0].toUpperCase(Locale.ROOT);
            return word.length() <= 10 ? word : word.substring(0, 10);
        }
        StringBuilder code = new StringBuilder();
        for (String word : words) {
            if (!word.isEmpty()) {
                code.append(Character.toUpperCase(word.charAt(0)));
            }
        }
        return code.toString();
    }

    private static String rowMessage(int rowNumber, String message) {
        return "Row " + rowNumber + ": " + message;
    }

    private static String cellString(Cell cell) {
        if (cell == null) return null;
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
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String normalizeNameKey(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
