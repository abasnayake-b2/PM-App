package com.nexuspm.teamroster;

import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.organisation.entity.Country;
import com.nexuspm.organisation.repository.CountryRepository;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.shared.config.DfnPmProperties;
import com.nexuspm.shared.audit.AuditNameEnricher;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import com.nexuspm.shared.storage.ProfilePictureStorageService;
import com.nexuspm.shared.util.ExcelUploadValidator;
import com.nexuspm.shared.util.ImageUploadValidator;
import com.nexuspm.teamroster.dto.*;
import com.nexuspm.teamroster.entity.TeamImportBatch;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamImportBatchRepository;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.user.EmployeeCleanupService;
import com.nexuspm.user.ManagementUserProvisioningService;
import com.nexuspm.user.EmployeeRosterRefs;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.entity.Designation;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Skill;
import com.nexuspm.user.entity.Stream;
import com.nexuspm.user.entity.WorkType;
import com.nexuspm.user.repository.DesignationRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.SkillRepository;
import com.nexuspm.user.repository.StreamRepository;
import com.nexuspm.user.repository.WorkTypeRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TeamRosterService {

    private final TeamManagementRepository managementRepository;
    private final ProjectRepository projectRepository;
    private final TeamImportBatchRepository importBatchRepository;
    private final EmployeeRepository employeeRepository;
    private final DesignationRepository designationRepository;
    private final StreamRepository streamRepository;
    private final WorkTypeRepository workTypeRepository;
    private final SkillRepository skillRepository;
    private final CountryRepository countryRepository;
    private final EmployeeCleanupService employeeCleanupService;
    private final ManagementUserProvisioningService managementUserProvisioningService;
    private final UserAuthRepository userAuthRepository;
    private final EntityManager entityManager;
    private final DfnPmProperties properties;
    private final AuditNameEnricher auditNameEnricher;
    private final ProfilePictureStorageService profilePictureStorageService;

    @Transactional(readOnly = true)
    public List<TeamManagementResponse> listManagement(String search) {
        String term = normalizeSearch(search);
        List<TeamManagement> rows = managementRepository.search(term);
        auditNameEnricher.enrichAll(rows);
        return rows.stream().map(this::toManagementResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<TeamRosterMemberResponse> listMembers(String search) {
        String term = normalizeSearch(search);
        List<Employee> rows = employeeRepository.searchRosterMembers(term);
        auditNameEnricher.enrichAll(rows);
        return rows.stream().map(this::toMemberResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<String> listEngineeringManagers() {
        return employeeRepository.findDistinctEngineeringManagers();
    }

    @Transactional(readOnly = true)
    public Optional<TeamImportResult> latestManagementImport() {
        return importBatchRepository.findTopByManagementCountGreaterThanOrderByCreatedAtDesc(0)
                .map(this::toImportResult);
    }

    @Transactional(readOnly = true)
    public Optional<TeamImportResult> latestMembersImport() {
        return importBatchRepository.findTopByMemberCountGreaterThanOrderByCreatedAtDesc(0)
                .map(this::toImportResult);
    }

    @Transactional
    public TeamImportResult importManagementExcel(MultipartFile file) {
        TeamImportBatch batch = createImportBatch(file);

        List<TeamManagement> managementRows = new ArrayList<>();
        Map<UUID, String> supervisorNames = new HashMap<>();
        Map<UUID, String> systemRoleCodes = new HashMap<>();
        Map<UUID, String> relinkKeys = captureManagementRelinkKeys();
        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            parseManagementSheet(workbook, batch, managementRows, supervisorNames, systemRoleCodes);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("IMPORT_FAILED", "Failed to read Excel file: " + ex.getMessage(), 400);
        }

        clearManagementRoster();
        managementRepository.saveAll(managementRows);
        linkSupervisors(managementRows, supervisorNames);
        managementRepository.saveAll(managementRows);
        relinkLoginUsersToManagement(managementRows, relinkKeys);
        List<ManagementUserProvisioned> provisionedUsers =
                managementUserProvisioningService.provisionFromManagementImport(managementRows, systemRoleCodes);

        batch.setManagementCount(managementRows.size());
        batch.setMemberCount(0);
        importBatchRepository.save(batch);

        return toImportResult(batch, provisionedUsers);
    }

    @Transactional
    public TeamImportResult importMembersExcel(MultipartFile file) {
        TeamImportBatch batch = createImportBatch(file);

        List<ImportedMemberRow> memberRows = new ArrayList<>();
        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            parseTeamSheet(workbook, batch, memberRows);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("IMPORT_FAILED", "Failed to read Excel file: " + ex.getMessage(), 400);
        }

        validateMembersAgainstManagementRoster(memberRows);

        DesignationLookup designationLookup = indexDesignations();
        StreamLookup streamLookup = indexStreams();
        List<TeamManagement> managementRoster = managementRepository.findAll();
        for (ImportedMemberRow imported : memberRows) {
            applyRosterReferences(
                    imported.employee(),
                    RosterLinkInput.fromImport(imported.fields()),
                    designationLookup,
                    streamLookup,
                    managementRoster);
        }

        clearRosterEmployees();
        List<Employee> entities = memberRows.stream().map(ImportedMemberRow::employee).toList();
        employeeRepository.saveAll(entities);

        batch.setManagementCount(0);
        batch.setMemberCount(entities.size());
        importBatchRepository.save(batch);

        return toImportResult(batch);
    }

    private TeamImportBatch createImportBatch(MultipartFile file) {
        ExcelUploadValidator.validate(file, properties);

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.xlsx";

        TeamImportBatch batch = new TeamImportBatch();
        batch.setId(UUID.randomUUID());
        batch.setFileName(fileName);
        UUID userId = SecurityUtils.currentUserId();
        if (userId != null) {
            employeeRepository.findById(userId).ifPresent(batch::setImportedBy);
        }
        return importBatchRepository.save(batch);
    }

    private Map<UUID, String> captureManagementRelinkKeys() {
        Map<UUID, String> relinkKeys = new LinkedHashMap<>();
        for (Employee employee : employeeRepository.findAllLinkedToManagement()) {
            if (employee.getTeamManagement() != null) {
                relinkKeys.put(employee.getId(), normalizeNameKey(employee.getTeamManagement().getFullName()));
            }
        }
        return relinkKeys;
    }

    private void clearManagementRoster() {
        List<Employee> linkedEmployees = employeeRepository.findAllLinkedToManagement();
        if (!linkedEmployees.isEmpty()) {
            linkedEmployees.forEach(employee -> employee.setTeamManagement(null));
            employeeRepository.saveAll(linkedEmployees);
            entityManager.flush();
        }

        projectRepository.clearAllEngineeringManagerManagement();
        entityManager.flush();

        List<TeamManagement> existingManagement = managementRepository.findAll();
        existingManagement.forEach(m -> m.setSupervisor(null));
        managementRepository.saveAll(existingManagement);
        entityManager.flush();
        managementRepository.deleteAll();
    }

    private void detachManagementReferences(UUID managementId) {
        projectRepository.clearEngineeringManagerManagement(managementId);
        managementRepository.clearSupervisorReferences(managementId);
        entityManager.flush();
    }

    private void clearRosterEmployees() {
        List<UUID> rosterIds = employeeRepository.findRosterEmployeeIdsWithoutLogin();
        if (rosterIds.isEmpty()) {
            return;
        }
        employeeCleanupService.detachEmployeesForDeletion(rosterIds);
        employeeRepository.deleteAllById(rosterIds);
    }

    private TeamImportResult toImportResult(TeamImportBatch batch) {
        return toImportResult(batch, List.of());
    }

    private TeamImportResult toImportResult(TeamImportBatch batch, List<ManagementUserProvisioned> provisionedUsers) {
        return TeamImportResult.builder()
                .batchId(batch.getId())
                .fileName(batch.getFileName())
                .managementImported(batch.getManagementCount())
                .membersImported(batch.getMemberCount())
                .usersCreated(provisionedUsers.size())
                .provisionedUsers(provisionedUsers)
                .importedByName(batch.getImportedBy() != null ? batch.getImportedBy().getFullName() : null)
                .importedAt(batch.getCreatedAt())
                .build();
    }

    @Transactional
    public TeamManagementResponse createManagement(TeamManagementRequest request) {
        TeamManagement entity = new TeamManagement();
        entity.setId(UUID.randomUUID());
        applyManagementRequest(entity, request);
        return toManagementResponse(auditNameEnricher.enrich(managementRepository.save(entity)));
    }

    @Transactional
    public TeamManagementResponse updateManagement(UUID id, TeamManagementRequest request) {
        TeamManagement entity = managementRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Management record not found", 404));
        applyManagementRequest(entity, request);
        return toManagementResponse(auditNameEnricher.enrich(managementRepository.save(entity)));
    }

    @Transactional
    public void deleteManagement(UUID id) {
        if (!managementRepository.existsById(id)) {
            throw new BusinessException("NOT_FOUND", "Management record not found", 404);
        }

        // Login users are linked via employee.team_management_id — unlink + deactivate so delete can proceed.
        employeeRepository.findByTeamManagementId(id).ifPresent(employee -> {
            employee.setTeamManagement(null);
            employee.setStatus("INACTIVE");
            employeeRepository.save(employee);
            userAuthRepository.findByEmployeeId(employee.getId()).ifPresent(auth -> {
                auth.setActive(false);
                userAuthRepository.save(auth);
            });
        });

        // Roster engineers may still point at this person as their EM.
        employeeRepository.clearEngineeringManagerManagement(id);
        detachManagementReferences(id);
        entityManager.flush();
        managementRepository.deleteById(id);
    }

    @Transactional
    public RelinkSupervisorsResult relinkManagementSupervisors() {
        List<TeamManagement> rows = managementRepository.findAll();
        int linked = (int) rows.stream().filter(row -> row.getSupervisor() != null).count();
        return RelinkSupervisorsResult.builder()
                .totalRecords(rows.size())
                .linkedCount(linked)
                .unresolvedCount(rows.size() - linked)
                .build();
    }

    @Transactional
    public TeamRosterMemberResponse createMember(TeamRosterMemberRequest request) {
        Employee entity = new Employee();
        entity.setId(UUID.randomUUID());
        entity.setStatus("ACTIVE");
        entity.setBenchStatus("ASSIGNED");
        applyMemberRequest(entity, request);
        return toMemberResponse(auditNameEnricher.enrich(employeeRepository.save(entity)));
    }

    @Transactional
    public TeamRosterMemberResponse updateMember(UUID id, TeamRosterMemberRequest request) {
        Employee entity = employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        ensureRosterEmployee(entity);
        applyMemberRequest(entity, request);
        return toMemberResponse(auditNameEnricher.enrich(employeeRepository.save(entity)));
    }

    @Transactional
    public void deleteMember(UUID id) {
        Employee entity = employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        ensureRosterEmployee(entity);
        if (userAuthRepository.existsByEmployeeId(id)) {
            throw new BusinessException("VALIDATION", "Cannot delete a login user from the employee roster", 400);
        }
        String picture = entity.getProfilePicture();
        employeeCleanupService.detachEmployeesForDeletion(List.of(id));
        employeeRepository.delete(entity);
        profilePictureStorageService.deleteIfPresent(picture);
    }

    @Transactional
    public TeamRosterMemberResponse uploadMemberPhoto(UUID id, MultipartFile file) {
        Employee entity = employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        ensureRosterEmployee(entity);

        String previous = entity.getProfilePicture();
        String filename = profilePictureStorageService.store(id, file);
        if (previous != null && !previous.equals(filename)) {
            profilePictureStorageService.deleteIfPresent(previous);
        }
        entity.setProfilePicture(filename);
        return toMemberResponse(auditNameEnricher.enrich(employeeRepository.save(entity)));
    }

    @Transactional
    public TeamRosterMemberResponse deleteMemberPhoto(UUID id) {
        Employee entity = employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        ensureRosterEmployee(entity);

        String previous = entity.getProfilePicture();
        entity.setProfilePicture(null);
        TeamRosterMemberResponse response = toMemberResponse(
                auditNameEnricher.enrich(employeeRepository.save(entity)));
        profilePictureStorageService.deleteIfPresent(previous);
        return response;
    }

    @Transactional(readOnly = true)
    public ProfilePictureFile loadMemberPhoto(UUID id) {
        Employee entity = employeeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Employee not found", 404));
        ensureRosterEmployee(entity);
        Path path = profilePictureStorageService.resolveExisting(entity.getProfilePicture());
        String ext = ImageUploadValidator.extensionOf(entity.getProfilePicture());
        MediaType mediaType = MediaType.parseMediaType(ImageUploadValidator.contentTypeForExtension(ext));
        return new ProfilePictureFile(new FileSystemResource(path), mediaType);
    }

    public record ProfilePictureFile(Resource resource, MediaType mediaType) {
    }

    private void ensureRosterEmployee(Employee entity) {
        if (userAuthRepository.existsByEmployeeId(entity.getId())) {
            throw new BusinessException("VALIDATION", "This record is a system login user, not a roster employee", 400);
        }
    }

    private Sheet resolveSheet(Workbook workbook, String preferredName) {
        Sheet sheet = workbook.getSheet(preferredName);
        if (sheet == null && workbook.getNumberOfSheets() > 0) {
            sheet = workbook.getSheetAt(0);
        }
        if (sheet == null) {
            throw new BusinessException("IMPORT_FAILED", "No worksheet found in workbook", 400);
        }
        return sheet;
    }

    private void parseManagementSheet(
            Workbook workbook,
            TeamImportBatch batch,
            List<TeamManagement> out,
            Map<UUID, String> supervisorNames,
            Map<UUID, String> systemRoleCodes) {
        Sheet sheet = resolveSheet(workbook, "Management");
        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) continue;
            String role = cellString(row.getCell(0));
            String firstName = cellString(row.getCell(1));
            String lastName = cellString(row.getCell(2));
            if (isBlank(role) && isBlank(firstName) && isBlank(lastName)) continue;
            if (isBlank(role) || isBlank(firstName)) continue;

            TeamManagement m = new TeamManagement();
            m.setId(UUID.randomUUID());
            m.setRoleTitle(role.trim());
            m.setFirstName(firstName.trim());
            m.setLastName(lastName != null ? lastName.trim() : "");
            supervisorNames.put(m.getId(), trimOrNull(cellString(row.getCell(3))));
            systemRoleCodes.put(m.getId(), trimOrNull(cellString(row.getCell(4))));
            m.setImportBatch(batch);
            m.setStatus("ACTIVE");
            out.add(m);
        }
    }

    private void parseTeamSheet(Workbook workbook, TeamImportBatch batch, List<ImportedMemberRow> out) {
        Sheet sheet = resolveSheet(workbook, "Team");
        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null) continue;
            String name = cellString(row.getCell(0));
            if (isBlank(name)) continue;

            Employee employee = new Employee();
            employee.setId(UUID.randomUUID());
            applyName(employee, name.trim());
            RosterImportFields fields = new RosterImportFields(
                    trimOrNull(cellString(row.getCell(1))),
                    trimOrNull(cellString(row.getCell(2))),
                    trimOrNull(cellString(row.getCell(3))),
                    trimOrNull(cellString(row.getCell(4))),
                    trimOrNull(cellString(row.getCell(5))),
                    trimOrNull(cellString(row.getCell(6))));
            employee.setProduct(trimOrNull(cellString(row.getCell(7))));
            employee.setEmail(trimOrNull(cellString(row.getCell(8))));
            employee.setPhone(trimOrNull(cellString(row.getCell(9))));
            employee.setImportBatch(batch);
            employee.setStatus("ACTIVE");
            employee.setBenchStatus("ASSIGNED");
            out.add(new ImportedMemberRow(rowIdx + 1, employee, fields));
        }
    }

    private void validateMembersAgainstManagementRoster(List<ImportedMemberRow> rows) {
        List<TeamManagement> managementRoster = managementRepository.findAll();
        if (managementRoster.isEmpty()) {
            throw new BusinessException(
                    "IMPORT_VALIDATION",
                    "Upload the Management Excel first. Employee rows reference engineering managers from that roster.",
                    400);
        }

        List<String> errors = new ArrayList<>();
        for (ImportedMemberRow imported : rows) {
            String emName = imported.fields().engineeringManagerName();
            if (isBlank(emName)) {
                continue;
            }
            if (resolveEngineeringManager(emName, managementRoster) == null) {
                errors.add("Row " + imported.rowNumber() + ": Engineering manager (EM) \""
                        + emName.trim()
                        + "\" was not found in the management roster. Upload or fix the Management Excel first.");
            }
        }
        throwImportValidationErrors(errors);
    }

    private void validateEngineeringManagerReference(UUID managementId, String emName) {
        if (managementId != null) {
            if (!managementRepository.existsById(managementId)) {
                throw new BusinessException("NOT_FOUND", "Engineering manager not found in management roster", 400);
            }
            return;
        }
        if (isBlank(emName)) {
            return;
        }
        List<TeamManagement> managementRoster = managementRepository.findAll();
        if (managementRoster.isEmpty()) {
            throw new BusinessException(
                    "VALIDATION",
                    "No management roster loaded. Import Management Excel before assigning an engineering manager.",
                    400);
        }
        if (resolveEngineeringManager(emName, managementRoster) == null) {
            throw new BusinessException(
                    "VALIDATION",
                    "Engineering manager \"" + emName.trim() + "\" was not found in the management roster",
                    400);
        }
    }

    private void throwImportValidationErrors(List<String> errors) {
        if (errors.isEmpty()) {
            return;
        }
        String detail = errors.size() == 1
                ? errors.get(0)
                : "Import validation failed:\n" + String.join("\n", errors);
        throw new BusinessException("IMPORT_VALIDATION", detail, 400);
    }

    private record ImportedMemberRow(int rowNumber, Employee employee, RosterImportFields fields) {}

    private record RosterImportFields(
            String designationCode,
            String designationTitle,
            String teamName,
            String engineeringManagerName,
            String workType,
            String country) {}

    private record RosterLinkInput(
            UUID designationId,
            UUID streamId,
            UUID engineeringManagerManagementId,
            UUID workTypeId,
            UUID countryId,
            RosterImportFields importFields) {

        static RosterLinkInput fromImport(RosterImportFields fields) {
            return new RosterLinkInput(null, null, null, null, null, fields);
        }

        static RosterLinkInput fromRequest(TeamRosterMemberRequest request) {
            return new RosterLinkInput(
                    request.getDesignationId(),
                    request.getStreamId(),
                    request.getEngineeringManagerManagementId(),
                    request.getWorkTypeId(),
                    request.getCountryId(),
                    new RosterImportFields(
                            trimOrNullStatic(request.getDesignationCode()),
                            trimOrNullStatic(request.getDesignation()),
                            trimOrNullStatic(request.getTeamName()),
                            trimOrNullStatic(request.getEngineeringManagerName()),
                            trimOrNullStatic(request.getWorkType()),
                            trimOrNullStatic(request.getCountry())));
        }
    }

    private void relinkLoginUsersToManagement(List<TeamManagement> rows, Map<UUID, String> relinkKeys) {
        if (relinkKeys.isEmpty() || rows.isEmpty()) {
            return;
        }
        Map<String, TeamManagement> byName = rows.stream()
                .collect(Collectors.toMap(
                        m -> normalizeNameKey(m.getFullName()),
                        m -> m,
                        (a, b) -> a));

        for (Map.Entry<UUID, String> entry : relinkKeys.entrySet()) {
            TeamManagement match = resolveSupervisor(entry.getValue(), byName);
            if (match == null) {
                continue;
            }
            if (employeeRepository.existsByTeamManagementId(match.getId())) {
                continue;
            }
            employeeRepository.findById(entry.getKey()).ifPresent(employee -> {
                employee.setTeamManagement(match);
                employee.setFirstName(match.getFirstName());
                employee.setLastName(match.getLastName());
                employeeRepository.save(employee);
            });
        }
    }

    private void linkSupervisors(List<TeamManagement> rows, Map<UUID, String> supervisorNames) {
        Map<String, TeamManagement> byName = rows.stream()
                .collect(Collectors.toMap(
                        m -> normalizeNameKey(m.getFullName()),
                        m -> m,
                        (a, b) -> a));

        for (TeamManagement row : rows) {
            String supervisorName = supervisorNames.get(row.getId());
            if (isBlank(supervisorName)) continue;
            TeamManagement supervisor = resolveSupervisor(supervisorName, byName);
            if (supervisor != null) {
                row.setSupervisor(supervisor);
            }
        }
    }

    private TeamManagement resolveSupervisor(String supervisorName, Map<String, TeamManagement> byName) {
        String key = normalizeNameKey(supervisorName);
        if (byName.containsKey(key)) {
            return byName.get(key);
        }
        String compact = key.replace(" ", "");
        for (Map.Entry<String, TeamManagement> entry : byName.entrySet()) {
            if (entry.getKey().replace(" ", "").equals(compact)) {
                return entry.getValue();
            }
        }
        for (Map.Entry<String, TeamManagement> entry : byName.entrySet()) {
            if (entry.getKey().contains(key) || key.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private TeamManagement resolveEngineeringManager(String emName, List<TeamManagement> roster) {
        if (isBlank(emName) || roster.isEmpty()) {
            return null;
        }
        Map<String, TeamManagement> index = buildManagementNameIndex(roster);
        for (String variant : emNameVariants(emName)) {
            TeamManagement match = resolveSupervisor(variant, index);
            if (match != null) {
                return match;
            }
        }
        for (String variant : emNameVariants(emName)) {
            for (TeamManagement manager : roster) {
                if (managementNameMatchesVariant(manager, variant)) {
                    return manager;
                }
            }
        }
        return null;
    }

    private Map<String, TeamManagement> buildManagementNameIndex(List<TeamManagement> roster) {
        Map<String, TeamManagement> index = new LinkedHashMap<>();
        for (TeamManagement manager : roster) {
            putNameIndex(index, normalizeNameKey(manager.getFullName()), manager);
            putNameIndex(index, normalizeNameKey(manager.getFirstName() + " " + manager.getLastName()), manager);
            if (!isBlank(manager.getFirstName()) && !isBlank(manager.getLastName())) {
                putNameIndex(
                        index,
                        normalizeNameKey(manager.getFirstName() + " " + manager.getLastName().charAt(0)),
                        manager);
            }
        }
        return index;
    }

    private void putNameIndex(Map<String, TeamManagement> index, String key, TeamManagement manager) {
        if (isBlank(key) || manager == null) {
            return;
        }
        index.putIfAbsent(key, manager);
    }

    private List<String> emNameVariants(String name) {
        LinkedHashSet<String> variants = new LinkedHashSet<>();
        String normalized = normalizeNameKey(name);
        variants.add(normalized);
        variants.add(stripTeamSuffix(normalized));
        int hyphen = normalized.indexOf('-');
        if (hyphen > 0) {
            variants.add(normalized.substring(0, hyphen).trim());
        }
        int dash = normalized.indexOf(" - ");
        if (dash > 0) {
            variants.add(normalized.substring(0, dash).trim());
        }
        return variants.stream().filter(v -> !v.isBlank()).toList();
    }

    private String stripTeamSuffix(String normalizedName) {
        int hyphen = normalizedName.indexOf('-');
        if (hyphen > 0) {
            return normalizedName.substring(0, hyphen).trim();
        }
        int dash = normalizedName.indexOf(" - ");
        if (dash > 0) {
            return normalizedName.substring(0, dash).trim();
        }
        return normalizedName;
    }

    private boolean managementNameMatchesVariant(TeamManagement manager, String variant) {
        if (isBlank(variant)) {
            return false;
        }
        String full = normalizeNameKey(manager.getFullName());
        if (variant.equals(full) || variant.contains(full) || full.contains(variant)) {
            return true;
        }
        String first = normalizeNameKey(manager.getFirstName());
        String last = normalizeNameKey(manager.getLastName());
        if (first.isEmpty() || !variant.startsWith(first)) {
            return false;
        }
        String remainder = variant.substring(first.length()).trim();
        if (remainder.isEmpty()) {
            return true;
        }
        if (last.isEmpty()) {
            return true;
        }
        if (last.length() <= 2) {
            return remainder.charAt(0) == last.charAt(0);
        }
        return remainder.startsWith(last)
                || remainder.contains(" " + last)
                || last.startsWith(remainder.split(" ")[0]);
    }

    private void applyManagementRequest(TeamManagement entity, TeamManagementRequest request) {
        entity.setRoleTitle(request.getRoleTitle().trim());
        entity.setFirstName(request.getFirstName().trim());
        entity.setLastName(request.getLastName().trim());
        if (request.getSupervisorId() != null) {
            TeamManagement supervisor = managementRepository.findById(request.getSupervisorId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Supervisor not found", 400));
            if (supervisor.getId().equals(entity.getId())) {
                throw new BusinessException("INVALID_SUPERVISOR", "A person cannot supervise themselves", 400);
            }
            entity.setSupervisor(supervisor);
        } else if (!isBlank(request.getSupervisorName())) {
            String supervisorName = request.getSupervisorName().trim();
            Map<String, TeamManagement> byName = managementRepository.findAll().stream()
                    .filter(row -> !row.getId().equals(entity.getId()))
                    .collect(Collectors.toMap(
                            m -> normalizeNameKey(m.getFullName()),
                            m -> m,
                            (a, b) -> a));
            TeamManagement supervisor = resolveSupervisor(supervisorName, byName);
            entity.setSupervisor(supervisor);
        } else {
            entity.setSupervisor(null);
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            entity.setStatus(request.getStatus().trim().toUpperCase());
        }
    }

    private void applyMemberRequest(Employee entity, TeamRosterMemberRequest request) {
        applyName(entity, request.getFullName().trim());
        entity.setProduct(trimOrNull(request.getProduct()));
        entity.setEmail(trimOrNull(request.getEmail()));
        entity.setPhone(trimOrNull(request.getPhone()));
        entity.setTotalYearsOfExperience(request.getTotalYearsOfExperience());
        entity.setExperienceInDfn(request.getExperienceInDfn());
        applySkills(entity, request.getSkillIds());
        validateEngineeringManagerReference(
                request.getEngineeringManagerManagementId(),
                request.getEngineeringManagerName());
        applyRosterReferences(
                entity,
                RosterLinkInput.fromRequest(request),
                indexDesignations(),
                indexStreams(),
                managementRepository.findAll());
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            entity.setStatus(request.getStatus().trim().toUpperCase());
        }
    }

    private void applySkills(Employee entity, List<UUID> skillIds) {
        entity.getSkills().clear();
        if (skillIds == null || skillIds.isEmpty()) {
            return;
        }
        List<UUID> distinctIds = skillIds.stream().filter(Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            return;
        }
        List<Skill> skills = skillRepository.findAllById(distinctIds);
        if (skills.size() != distinctIds.size()) {
            throw new BusinessException("NOT_FOUND", "One or more skills were not found", 400);
        }
        entity.getSkills().addAll(skills);
    }

    private void applyName(Employee entity, String fullName) {
        String[] parts = splitFullName(fullName);
        entity.setFirstName(parts[0]);
        entity.setLastName(parts[1]);
    }

    private String[] splitFullName(String fullName) {
        String trimmed = fullName != null ? fullName.trim() : "";
        if (trimmed.isEmpty()) {
            return new String[] { "Employee", "-" };
        }
        int space = trimmed.indexOf(' ');
        if (space < 0) {
            return new String[] { trimmed, "-" };
        }
        return new String[] { trimmed.substring(0, space), trimmed.substring(space + 1).trim() };
    }

    private TeamManagementResponse toManagementResponse(TeamManagement m) {
        return TeamManagementResponse.builder()
                .id(m.getId())
                .roleTitle(m.getRoleTitle())
                .firstName(m.getFirstName())
                .lastName(m.getLastName())
                .fullName(m.getFullName())
                .supervisorName(m.getSupervisor() != null ? m.getSupervisor().getFullName() : null)
                .supervisorId(m.getSupervisor() != null ? m.getSupervisor().getId() : null)
                .supervisorFullName(m.getSupervisor() != null ? m.getSupervisor().getFullName() : null)
                .status(m.getStatus())
                .createdAt(m.getCreatedAt())
                .updatedAt(m.getUpdatedAt())
                .createdBy(m.getCreatedBy())
                .updatedBy(m.getUpdatedBy())
                .createdByName(m.getCreatedByName())
                .updatedByName(m.getUpdatedByName())
                .build();
    }

    private TeamRosterMemberResponse toMemberResponse(Employee employee) {
        List<Skill> skills = employee.getSkills() == null
                ? List.of()
                : employee.getSkills().stream()
                        .sorted(Comparator.comparing(s -> s.getName() == null ? "" : s.getName(), String.CASE_INSENSITIVE_ORDER))
                        .toList();
        return TeamRosterMemberResponse.builder()
                .id(employee.getId())
                .fullName(employee.getFullName())
                .designationId(employee.getDesignation() != null ? employee.getDesignation().getId() : null)
                .designationCode(EmployeeRosterRefs.designationCode(employee))
                .designation(EmployeeRosterRefs.designationName(employee))
                .streamId(employee.getStream() != null ? employee.getStream().getId() : null)
                .teamName(EmployeeRosterRefs.teamName(employee))
                .engineeringManagerManagementId(employee.getEngineeringManagerManagement() != null
                        ? employee.getEngineeringManagerManagement().getId()
                        : null)
                .engineeringManagerName(EmployeeRosterRefs.engineeringManagerName(employee))
                .workTypeId(employee.getWorkType() != null ? employee.getWorkType().getId() : null)
                .workType(EmployeeRosterRefs.workTypeName(employee))
                .countryId(employee.getCountry() != null ? employee.getCountry().getId() : null)
                .country(EmployeeRosterRefs.countryLabel(employee))
                .product(employee.getProduct())
                .email(employee.getEmail())
                .phone(employee.getPhone())
                .profilePictureUrl(ProfilePictureStorageService.memberPhotoUrl(
                        employee.getId(), employee.getProfilePicture(), employee.getUpdatedAt()))
                .status(employee.getStatus())
                .skillIds(skills.stream().map(Skill::getId).toList())
                .skillNames(skills.stream().map(Skill::getName).toList())
                .totalYearsOfExperience(employee.getTotalYearsOfExperience())
                .experienceInDfn(employee.getExperienceInDfn())
                .createdAt(employee.getCreatedAt())
                .updatedAt(employee.getUpdatedAt())
                .createdBy(employee.getCreatedBy())
                .updatedBy(employee.getUpdatedBy())
                .createdByName(employee.getCreatedByName())
                .updatedByName(employee.getUpdatedByName())
                .build();
    }

    private void applyRosterReferences(
            Employee employee,
            RosterLinkInput input,
            DesignationLookup designationLookup,
            StreamLookup streamLookup,
            List<TeamManagement> managementRoster) {
        RosterImportFields fields = input.importFields();
        String teamName = fields != null ? fields.teamName() : null;

        if (input.designationId() != null) {
            Designation designation = designationRepository.findById(input.designationId())
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Designation not found", 400));
            linkDesignation(employee, designation);
        } else if (fields != null) {
            linkDesignationFromTokens(employee, fields, designationLookup);
        }

        if (input.streamId() != null) {
            employee.setStream(entityManager.getReference(Stream.class, input.streamId()));
            streamRepository.findById(input.streamId()).ifPresent(stream -> {
                if (stream.getDepartment() != null && employee.getDepartment() == null) {
                    employee.setDepartment(stream.getDepartment());
                }
            });
        } else if (!isBlank(teamName)) {
            linkStreamFromName(employee, teamName, streamLookup);
        } else if (employee.getStream() == null
                && employee.getDesignation() != null
                && employee.getDesignation().getStream() != null) {
            employee.setStream(employee.getDesignation().getStream());
        }

        if (input.engineeringManagerManagementId() != null) {
            employee.setEngineeringManagerManagement(
                    entityManager.getReference(TeamManagement.class, input.engineeringManagerManagementId()));
        } else if (fields != null && !isBlank(fields.engineeringManagerName())) {
            TeamManagement em = resolveEngineeringManager(fields.engineeringManagerName(), managementRoster);
            employee.setEngineeringManagerManagement(em);
        } else {
            employee.setEngineeringManagerManagement(null);
        }

        if (input.workTypeId() != null) {
            employee.setWorkType(entityManager.getReference(WorkType.class, input.workTypeId()));
        } else if (fields != null && !isBlank(fields.workType())) {
            workTypeRepository.findByNameIgnoreCase(fields.workType())
                    .ifPresent(workType -> employee.setWorkType(
                            entityManager.getReference(WorkType.class, workType.getId())));
        } else {
            employee.setWorkType(null);
        }

        if (input.countryId() != null) {
            employee.setCountry(entityManager.getReference(Country.class, input.countryId()));
        } else if (fields != null && !isBlank(fields.country())) {
            resolveCountry(fields.country())
                    .ifPresent(country -> employee.setCountry(
                            entityManager.getReference(Country.class, country.getId())));
        } else {
            employee.setCountry(null);
        }
    }

    private void linkDesignationFromTokens(
            Employee employee, RosterImportFields fields, DesignationLookup designationLookup) {
        String code = fields.designationCode();
        String title = fields.designationTitle();
        if (title != null && code != null && title.equalsIgnoreCase(code)) {
            title = null;
        }

        Designation match = null;
        if (title != null) {
            match = designationLookup.resolve(null, title, fields.teamName());
        }
        if (match == null) {
            match = designationLookup.resolve(code, null, fields.teamName());
        }
        if (match != null) {
            linkDesignation(employee, match);
            return;
        }

        if (!isBlank(fields.teamName())) {
            linkStreamFromName(employee, fields.teamName(), indexStreams());
        }
    }

    private void linkDesignation(Employee employee, Designation match) {
        employee.setDesignation(entityManager.getReference(Designation.class, match.getId()));
        if (match.getDepartment() != null) {
            employee.setDepartment(entityManager.getReference(Department.class, match.getDepartment().getId()));
        }
        if (employee.getStream() == null && match.getStream() != null) {
            employee.setStream(entityManager.getReference(Stream.class, match.getStream().getId()));
        }
    }

    private void linkStreamFromName(Employee employee, String teamName, StreamLookup streamLookup) {
        Stream stream = streamLookup.resolve(teamName);
        if (stream == null) {
            return;
        }
        employee.setStream(entityManager.getReference(Stream.class, stream.getId()));
        if (stream.getDepartment() != null && employee.getDepartment() == null) {
            employee.setDepartment(entityManager.getReference(Department.class, stream.getDepartment().getId()));
        }
    }

    private Optional<Country> resolveCountry(String token) {
        if (isBlank(token)) {
            return Optional.empty();
        }
        return countryRepository.findFirstByDeletedFalseAndCodeIgnoreCase(token)
                .or(() -> countryRepository.findFirstByDeletedFalseAndNameIgnoreCase(token));
    }

    private StreamLookup indexStreams() {
        Map<String, Stream> byName = new HashMap<>();
        for (Stream stream : streamRepository.findAllWithDepartment()) {
            if (stream.getName() != null && !stream.getName().isBlank()) {
                byName.putIfAbsent(normalizeNameKey(stream.getName()), stream);
            }
        }
        return new StreamLookup(byName, streamRepository);
    }

    private record StreamLookup(Map<String, Stream> byName, StreamRepository streamRepository) {
        Stream resolve(String teamName) {
            if (teamName == null || teamName.isBlank()) {
                return null;
            }
            Stream match = byName.get(normalizeNameKey(teamName));
            if (match != null) {
                return match;
            }
            return streamRepository.findByNameIgnoreCase(teamName).orElse(null);
        }
    }

    private DesignationLookup indexDesignations() {
        Map<String, Designation> byCode = new HashMap<>();
        Map<String, Designation> byName = new HashMap<>();
        Map<String, Designation> byCodeAndStream = new HashMap<>();
        for (Designation designation : designationRepository.findAllWithDepartment()) {
            if (designation.getCode() != null && !designation.getCode().isBlank()) {
                String normalizedCode = designation.getCode().trim().toUpperCase(Locale.ROOT);
                byCode.putIfAbsent(normalizedCode, designation);
                if (designation.getStream() != null && designation.getStream().getName() != null) {
                    String streamKey = normalizedCode + "|" + normalizeNameKey(designation.getStream().getName());
                    byCodeAndStream.putIfAbsent(streamKey, designation);
                }
            }
            if (designation.getName() != null && !designation.getName().isBlank()) {
                byName.putIfAbsent(normalizeNameKey(designation.getName()), designation);
            }
        }
        return new DesignationLookup(byCode, byName, byCodeAndStream, designationRepository);
    }

    private record DesignationLookup(
            Map<String, Designation> byCode,
            Map<String, Designation> byName,
            Map<String, Designation> byCodeAndStream,
            DesignationRepository designationRepository) {

        Designation resolve(String code, String title, String teamName) {
            Designation match = resolveToken(code, teamName);
            if (match != null) {
                return match;
            }
            return resolveToken(title, teamName);
        }

        private Designation resolveToken(String token, String teamName) {
            if (token == null || token.isBlank()) {
                return null;
            }
            String trimmed = token.trim();
            String normalizedCode = trimmed.toUpperCase(Locale.ROOT);
            if (teamName != null && !teamName.isBlank()) {
                String streamKey = normalizedCode + "|" + normalizeNameKey(teamName);
                Designation streamMatch = byCodeAndStream.get(streamKey);
                if (streamMatch != null) {
                    return streamMatch;
                }
            }
            Designation byCodeMatch = byCode.get(normalizedCode);
            if (byCodeMatch != null) {
                return byCodeMatch;
            }
            Designation byNameMatch = byName.get(normalizeNameKey(trimmed));
            if (byNameMatch != null) {
                return byNameMatch;
            }
            return designationRepository.findByCodeIgnoreCase(trimmed).orElse(null);
        }
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

    private static String normalizeSearch(String search) {
        return search != null && !search.isBlank() ? search.trim() : null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String trimOrNullStatic(String value) {
        return trimOrNull(value);
    }

    private static String normalizeNameKey(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
