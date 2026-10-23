package com.nexuspm.admin;

import com.nexuspm.lookup.IssueTypeCatalog;
import com.nexuspm.lookup.entity.FunctionalUnitCategory;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.entity.ProjectType;
import com.nexuspm.lookup.entity.TaskCategory;
import com.nexuspm.lookup.entity.TaskType;
import com.nexuspm.lookup.dto.WorkCategoryResponse;
import com.nexuspm.lookup.entity.WorkCategory;
import com.nexuspm.lookup.entity.WorkCategoryDirector;
import com.nexuspm.lookup.entity.WorkCategoryManager;
import com.nexuspm.lookup.repository.FunctionalUnitCategoryRepository;
import com.nexuspm.lookup.repository.WorkCategoryDirectorRepository;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.lookup.repository.ProjectTypeRepository;
import com.nexuspm.lookup.repository.TaskCategoryRepository;
import com.nexuspm.lookup.repository.TaskTypeRepository;
import com.nexuspm.lookup.repository.WorkCategoryManagerRepository;
import com.nexuspm.lookup.repository.WorkCategoryRepository;
import com.nexuspm.project.repository.ProjectRepository;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.TeamManagementRepository;
import com.nexuspm.admin.dto.ReferenceRoleResponse;
import com.nexuspm.shared.audit.AuditNameEnricher;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.user.dto.DesignationResponse;
import com.nexuspm.user.dto.StreamResponse;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.entity.Designation;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.entity.Stream;
import com.nexuspm.user.entity.WorkType;
import com.nexuspm.user.entity.Skill;
import com.nexuspm.user.repository.DepartmentRepository;
import com.nexuspm.user.repository.DesignationRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.RoleRepository;
import com.nexuspm.user.repository.StreamRepository;
import com.nexuspm.user.repository.WorkTypeRepository;
import com.nexuspm.user.repository.SkillRepository;
import com.nexuspm.shared.cache.CacheNames;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReferenceDataService {

    private final DepartmentRepository departmentRepository;
    private final StreamRepository streamRepository;
    private final WorkTypeRepository workTypeRepository;
    private final SkillRepository skillRepository;
    private final DesignationRepository designationRepository;
    private final RoleRepository roleRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final TaskTypeRepository taskTypeRepository;
    private final TaskCategoryRepository taskCategoryRepository;
    private final ProjectTypeRepository projectTypeRepository;
    private final FunctionalUnitCategoryRepository functionalUnitCategoryRepository;
    private final WorkCategoryRepository workCategoryRepository;
    private final WorkCategoryManagerRepository workCategoryManagerRepository;
    private final WorkCategoryDirectorRepository workCategoryDirectorRepository;
    private final TeamManagementRepository teamManagementRepository;
    private final ProjectRepository projectRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final PriorityRepository priorityRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditNameEnricher auditNameEnricher;

    private static final Set<String> SYSTEM_ROLE_CODES = Set.of(
            "SUPER_ADMIN", "ADMIN", "CXO", "VP", "MANAGER", "EMPLOYEE");

    @Cacheable(cacheNames = CacheNames.DEPARTMENTS, key = "'all'")
    @Transactional(readOnly = true)
    public List<Department> listDepartments() {
        return auditNameEnricher.enrichAll(departmentRepository.findAll());
    }

    @CacheEvict(cacheNames = CacheNames.DEPARTMENTS, allEntries = true)
    @Transactional
    public Department createDepartment(String name) {
        if (departmentRepository.findAll().stream().anyMatch(d -> d.getName().equalsIgnoreCase(name.trim()))) {
            throw new BusinessException("DUPLICATE", "Department already exists", 400);
        }
        Department department = new Department();
        department.setId(UUID.randomUUID());
        department.setName(name.trim());
        return auditNameEnricher.enrich(departmentRepository.save(department));
    }

    @CacheEvict(cacheNames = CacheNames.DEPARTMENTS, allEntries = true)
    @Transactional
    public Department updateDepartment(UUID id, String name) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Department not found", 404));
        department.setName(name.trim());
        return auditNameEnricher.enrich(departmentRepository.save(department));
    }

    @CacheEvict(cacheNames = CacheNames.DEPARTMENTS, allEntries = true)
    @Transactional
    public void deleteDepartment(UUID id) {
        if (employeeRepository.findAll().stream().anyMatch(e -> e.getDepartment() != null && e.getDepartment().getId().equals(id))) {
            throw new BusinessException("IN_USE", "Department is assigned to employees", 400);
        }
        if (streamRepository.existsByDepartment_Id(id)) {
            throw new BusinessException("IN_USE", "Department is assigned to streams", 400);
        }
        departmentRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.STREAMS, key = "'all'")
    @Transactional(readOnly = true)
    public List<StreamResponse> listStreams() {
        List<Stream> streams = streamRepository.findAllWithDepartment();
        auditNameEnricher.enrichAll(streams);
        return streams.stream().map(this::toStreamResponse).toList();
    }

    @CacheEvict(cacheNames = CacheNames.STREAMS, allEntries = true)
    @Transactional
    public StreamResponse createStream(String name, UUID departmentId) {
        if (streamRepository.findAll().stream().anyMatch(s -> s.getName().equalsIgnoreCase(name.trim()))) {
            throw new BusinessException("DUPLICATE", "Stream already exists", 400);
        }
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new BusinessException("INVALID_DEPARTMENT", "Department not found", 400));
        Stream stream = new Stream();
        stream.setId(UUID.randomUUID());
        stream.setName(name.trim());
        stream.setDepartment(department);
        return toStreamResponse(auditNameEnricher.enrich(streamRepository.save(stream)));
    }

    @CacheEvict(cacheNames = CacheNames.STREAMS, allEntries = true)
    @Transactional
    public StreamResponse updateStream(UUID id, String name, UUID departmentId) {
        Stream stream = streamRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Stream not found", 404));
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new BusinessException("INVALID_DEPARTMENT", "Department not found", 400));
        stream.setName(name.trim());
        stream.setDepartment(department);
        return toStreamResponse(auditNameEnricher.enrich(streamRepository.save(stream)));
    }

    @CacheEvict(cacheNames = {CacheNames.STREAMS, CacheNames.DESIGNATIONS}, allEntries = true)
    @Transactional
    public void deleteStream(UUID id) {
        if (designationRepository.existsByStream_Id(id)) {
            throw new BusinessException("IN_USE", "Stream is assigned to designations", 400);
        }
        streamRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.DESIGNATIONS, key = "'all'")
    @Transactional(readOnly = true)
    public List<DesignationResponse> listDesignations() {
        List<Designation> designations = designationRepository.findAllWithDepartment();
        auditNameEnricher.enrichAll(designations);
        return designations.stream().map(this::toDesignationResponse).toList();
    }

    @CacheEvict(cacheNames = CacheNames.DESIGNATIONS, allEntries = true)
    @Transactional
    public DesignationResponse createDesignation(String name, String code, UUID streamId, boolean management) {
        Stream stream = streamRepository.findById(streamId)
                .orElseThrow(() -> new BusinessException("INVALID_STREAM", "Stream not found", 400));
        String trimmedName = name.trim();
        String normalizedCode = normalizeCode(code);
        if (designationRepository.existsByNameIgnoreCase(trimmedName)) {
            throw new BusinessException("DUPLICATE", "Designation \"" + trimmedName + "\" already exists", 400);
        }
        if (normalizedCode != null && designationRepository.existsByCodeIgnoreCase(normalizedCode)) {
            throw new BusinessException("DUPLICATE", "Designation code \"" + normalizedCode + "\" already exists", 400);
        }
        Designation designation = new Designation();
        designation.setId(UUID.randomUUID());
        designation.setName(trimmedName);
        designation.setCode(normalizedCode);
        designation.setStream(stream);
        designation.setDepartment(stream.getDepartment());
        designation.setManagement(management);
        return toDesignationResponse(auditNameEnricher.enrich(designationRepository.save(designation)));
    }

    @CacheEvict(cacheNames = CacheNames.DESIGNATIONS, allEntries = true)
    @Transactional
    public DesignationResponse updateDesignation(
            UUID id, String name, String code, UUID streamId, boolean management) {
        Designation designation = designationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Designation not found", 404));
        Stream stream = streamRepository.findById(streamId)
                .orElseThrow(() -> new BusinessException("INVALID_STREAM", "Stream not found", 400));
        String trimmedName = name.trim();
        String normalizedCode = normalizeCode(code);
        if (designationRepository.existsByNameIgnoreCaseAndIdNot(trimmedName, id)) {
            throw new BusinessException("DUPLICATE", "Designation \"" + trimmedName + "\" already exists", 400);
        }
        if (normalizedCode != null && designationRepository.existsByCodeIgnoreCaseAndIdNot(normalizedCode, id)) {
            throw new BusinessException("DUPLICATE", "Designation code \"" + normalizedCode + "\" already exists", 400);
        }
        designation.setName(trimmedName);
        designation.setCode(normalizedCode);
        designation.setStream(stream);
        designation.setDepartment(stream.getDepartment());
        designation.setManagement(management);
        return toDesignationResponse(auditNameEnricher.enrich(designationRepository.save(designation)));
    }

    @CacheEvict(cacheNames = CacheNames.DESIGNATIONS, allEntries = true)
    @Transactional
    public void deleteDesignation(UUID id) {
        if (employeeRepository.findAll().stream().anyMatch(e -> e.getDesignation() != null && e.getDesignation().getId().equals(id))) {
            throw new BusinessException("IN_USE", "Designation is assigned to employees", 400);
        }
        designationRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.ROLES, key = "'all'")
    @Transactional(readOnly = true)
    public List<ReferenceRoleResponse> listRoles() {
        List<Role> roles = roleRepository.findAll();
        auditNameEnricher.enrichAll(roles);
        return roles.stream()
                .sorted((a, b) -> {
                    int order = roleSortOrder(a.getCode()) - roleSortOrder(b.getCode());
                    return order != 0 ? order : a.getName().compareToIgnoreCase(b.getName());
                })
                .map(this::toRoleResponse)
                .toList();
    }

    @CacheEvict(cacheNames = {CacheNames.ROLES, CacheNames.ACCESS_ROLES}, allEntries = true)
    @Transactional
    public ReferenceRoleResponse createRole(String name, String code) {
        throw new BusinessException("NOT_ALLOWED", "Create roles under Admin → Roles & access.", 400);
    }

    @CacheEvict(cacheNames = {CacheNames.ROLES, CacheNames.ACCESS_ROLES}, allEntries = true)
    @Transactional
    public ReferenceRoleResponse updateRole(UUID id, String name) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Role not found", 404));
        role.setName(name.trim());
        return toRoleResponse(auditNameEnricher.enrich(roleRepository.save(role)));
    }

    @CacheEvict(cacheNames = {CacheNames.ROLES, CacheNames.ACCESS_ROLES}, allEntries = true)
    @Transactional
    public void deleteRole(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Role not found", 404));
        if (SYSTEM_ROLE_CODES.contains(role.getCode())) {
            throw new BusinessException("PROTECTED", "System roles cannot be deleted", 400);
        }
        if (employeeRepository.isRoleAssignedToEmployee(id)) {
            throw new BusinessException("IN_USE", "Role is assigned to employees and cannot be deleted", 400);
        }
        roleRepository.deletePermissionsByRoleId(id);
        roleRepository.delete(role);
    }

    private static int roleSortOrder(String code) {
        return switch (code) {
            case "SUPER_ADMIN" -> 1;
            case "ADMIN" -> 2;
            case "CXO" -> 3;
            case "VP" -> 4;
            case "MANAGER" -> 5;
            case "EMPLOYEE" -> 6;
            default -> 99;
        };
    }

    @Cacheable(cacheNames = CacheNames.ISSUE_TYPES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<IssueType> listIssueTypes() {
        return IssueTypeCatalog.filterAndSort(issueTypeRepository.findAll());
    }

    @CacheEvict(cacheNames = CacheNames.ISSUE_TYPES, allEntries = true)
    @Transactional
    public IssueType createIssueType(String name, String workflowCode, String description) {
        IssueType issueType = new IssueType();
        issueType.setId(UUID.randomUUID());
        issueType.setName(name.trim());
        issueType.setWorkflowCode(workflowCode.trim().toUpperCase());
        issueType.setDescription(description);
        return issueTypeRepository.save(issueType);
    }

    @CacheEvict(cacheNames = CacheNames.ISSUE_TYPES, allEntries = true)
    @Transactional
    public IssueType updateIssueType(UUID id, String name, String workflowCode, String description) {
        IssueType issueType = issueTypeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue type not found", 404));
        issueType.setName(name.trim());
        issueType.setWorkflowCode(workflowCode.trim().toUpperCase());
        issueType.setDescription(description);
        return issueTypeRepository.save(issueType);
    }

    @CacheEvict(cacheNames = CacheNames.ISSUE_TYPES, allEntries = true)
    @Transactional
    public void deleteIssueType(UUID id) {
        issueTypeRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.TASK_TYPES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<TaskType> listTaskTypes() {
        return auditNameEnricher.enrichAll(taskTypeRepository.findAllByOrderBySortOrderAscNameAsc());
    }

    @CacheEvict(cacheNames = CacheNames.TASK_TYPES, allEntries = true)
    @Transactional
    public TaskType createTaskType(String name, String description) {
        String trimmed = name.trim();
        if (taskTypeRepository.findByNameIgnoreCase(trimmed).isPresent()) {
            throw new BusinessException("DUPLICATE", "Task type already exists", 400);
        }
        TaskType taskType = new TaskType();
        taskType.setId(UUID.randomUUID());
        taskType.setName(trimmed);
        taskType.setDescription(trimToNull(description));
        taskType.setSortOrder(nextTaskTypeSortOrder());
        return auditNameEnricher.enrich(taskTypeRepository.save(taskType));
    }

    @CacheEvict(cacheNames = CacheNames.TASK_TYPES, allEntries = true)
    @Transactional
    public TaskType updateTaskType(UUID id, String name, String description) {
        TaskType taskType = taskTypeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Task type not found", 404));
        String trimmed = name.trim();
        taskTypeRepository.findByNameIgnoreCase(trimmed)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException("DUPLICATE", "Task type already exists", 400);
                });
        taskType.setName(trimmed);
        taskType.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(taskTypeRepository.save(taskType));
    }

    @CacheEvict(cacheNames = CacheNames.TASK_TYPES, allEntries = true)
    @Transactional
    public void deleteTaskType(UUID id) {
        if (!taskTypeRepository.existsById(id)) {
            throw new BusinessException("NOT_FOUND", "Task type not found", 404);
        }
        taskTypeRepository.deleteById(id);
    }

    private int nextTaskTypeSortOrder() {
        return taskTypeRepository.findAll().stream()
                .map(TaskType::getSortOrder)
                .filter(order -> order != null)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0) + 1;
    }

    @Cacheable(cacheNames = CacheNames.TASK_CATEGORIES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<TaskCategory> listTaskCategories() {
        return auditNameEnricher.enrichAll(taskCategoryRepository.findAllByOrderBySortOrderAscNameAsc());
    }

    @CacheEvict(cacheNames = CacheNames.TASK_CATEGORIES, allEntries = true)
    @Transactional
    public TaskCategory createTaskCategory(String name, String description) {
        String trimmed = name.trim();
        if (taskCategoryRepository.findByNameIgnoreCase(trimmed).isPresent()) {
            throw new BusinessException("DUPLICATE", "Task category already exists", 400);
        }
        TaskCategory category = new TaskCategory();
        category.setId(UUID.randomUUID());
        category.setName(trimmed);
        category.setDescription(trimToNull(description));
        category.setSortOrder(nextTaskCategorySortOrder());
        return auditNameEnricher.enrich(taskCategoryRepository.save(category));
    }

    @CacheEvict(cacheNames = CacheNames.TASK_CATEGORIES, allEntries = true)
    @Transactional
    public TaskCategory updateTaskCategory(UUID id, String name, String description) {
        TaskCategory category = taskCategoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Task category not found", 404));
        String trimmed = name.trim();
        taskCategoryRepository.findByNameIgnoreCase(trimmed)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException("DUPLICATE", "Task category already exists", 400);
                });
        category.setName(trimmed);
        category.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(taskCategoryRepository.save(category));
    }

    @CacheEvict(cacheNames = CacheNames.TASK_CATEGORIES, allEntries = true)
    @Transactional
    public void deleteTaskCategory(UUID id) {
        if (!taskCategoryRepository.existsById(id)) {
            throw new BusinessException("NOT_FOUND", "Task category not found", 404);
        }
        taskCategoryRepository.deleteById(id);
    }

    private int nextTaskCategorySortOrder() {
        return taskCategoryRepository.findAll().stream()
                .map(TaskCategory::getSortOrder)
                .filter(order -> order != null)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0) + 1;
    }

    @Cacheable(cacheNames = CacheNames.PROJECT_TYPES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<ProjectType> listProjectTypes() {
        return auditNameEnricher.enrichAll(projectTypeRepository.findAllByOrderBySortOrderAscNameAsc());
    }

    @CacheEvict(cacheNames = CacheNames.PROJECT_TYPES, allEntries = true)
    @Transactional
    public ProjectType createProjectType(String name, String description) {
        String trimmed = name.trim();
        if (projectTypeRepository.findByNameIgnoreCase(trimmed).isPresent()) {
            throw new BusinessException("DUPLICATE", "Project type already exists", 400);
        }
        ProjectType projectType = new ProjectType();
        projectType.setId(UUID.randomUUID());
        projectType.setName(trimmed);
        projectType.setDescription(trimToNull(description));
        projectType.setSortOrder(nextProjectTypeSortOrder());
        return auditNameEnricher.enrich(projectTypeRepository.save(projectType));
    }

    @CacheEvict(cacheNames = CacheNames.PROJECT_TYPES, allEntries = true)
    @Transactional
    public ProjectType updateProjectType(UUID id, String name, String description) {
        ProjectType projectType = projectTypeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Project type not found", 404));
        String trimmed = name.trim();
        projectTypeRepository.findByNameIgnoreCase(trimmed)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException("DUPLICATE", "Project type already exists", 400);
                });
        projectType.setName(trimmed);
        projectType.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(projectTypeRepository.save(projectType));
    }

    @CacheEvict(cacheNames = CacheNames.PROJECT_TYPES, allEntries = true)
    @Transactional
    public void deleteProjectType(UUID id) {
        if (!projectTypeRepository.existsById(id)) {
            throw new BusinessException("NOT_FOUND", "Project type not found", 404);
        }
        if (projectRepository.existsByProjectType_Id(id)) {
            throw new BusinessException("IN_USE", "Project type is assigned to one or more projects", 400);
        }
        projectTypeRepository.deleteById(id);
    }

    private int nextProjectTypeSortOrder() {
        return projectTypeRepository.findAll().stream()
                .map(ProjectType::getSortOrder)
                .filter(order -> order != null)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0) + 1;
    }

    @Cacheable(cacheNames = CacheNames.FUNCTIONAL_UNIT_CATEGORIES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<FunctionalUnitCategory> listFunctionalUnitCategories() {
        return auditNameEnricher.enrichAll(
                functionalUnitCategoryRepository.findAllByOrderBySortOrderAscNameAsc());
    }

    @CacheEvict(cacheNames = CacheNames.FUNCTIONAL_UNIT_CATEGORIES, allEntries = true)
    @Transactional
    public FunctionalUnitCategory createFunctionalUnitCategory(String name, String description) {
        String trimmed = name.trim();
        if (functionalUnitCategoryRepository.findByNameIgnoreCase(trimmed).isPresent()) {
            throw new BusinessException("DUPLICATE", "Functional unit category already exists", 400);
        }
        FunctionalUnitCategory category = new FunctionalUnitCategory();
        category.setId(UUID.randomUUID());
        category.setName(trimmed);
        category.setDescription(trimToNull(description));
        category.setSortOrder(nextFunctionalUnitCategorySortOrder());
        return auditNameEnricher.enrich(functionalUnitCategoryRepository.save(category));
    }

    @CacheEvict(cacheNames = {CacheNames.FUNCTIONAL_UNIT_CATEGORIES, CacheNames.WORK_CATEGORIES}, allEntries = true)
    @Transactional
    public FunctionalUnitCategory updateFunctionalUnitCategory(UUID id, String name, String description) {
        FunctionalUnitCategory category = functionalUnitCategoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Functional unit category not found", 404));
        String trimmed = name.trim();
        functionalUnitCategoryRepository.findByNameIgnoreCase(trimmed)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException("DUPLICATE", "Functional unit category already exists", 400);
                });
        category.setName(trimmed);
        category.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(functionalUnitCategoryRepository.save(category));
    }

    @CacheEvict(cacheNames = {CacheNames.FUNCTIONAL_UNIT_CATEGORIES, CacheNames.WORK_CATEGORIES}, allEntries = true)
    @Transactional
    public void deleteFunctionalUnitCategory(UUID id) {
        if (!functionalUnitCategoryRepository.existsById(id)) {
            throw new BusinessException("NOT_FOUND", "Functional unit category not found", 404);
        }
        if (workCategoryRepository.existsByFunctionalUnitCategory_Id(id)) {
            throw new BusinessException(
                    "IN_USE", "Functional unit category is assigned to one or more functional units", 400);
        }
        functionalUnitCategoryRepository.deleteById(id);
    }

    private int nextFunctionalUnitCategorySortOrder() {
        return functionalUnitCategoryRepository.findAll().stream()
                .map(FunctionalUnitCategory::getSortOrder)
                .filter(order -> order != null)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0) + 1;
    }

    @Cacheable(cacheNames = CacheNames.WORK_CATEGORIES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<WorkCategoryResponse> listWorkCategories() {
        List<WorkCategory> categories =
                auditNameEnricher.enrichAll(workCategoryRepository.findAllByOrderBySortOrderAscNameAsc());
        Map<UUID, List<WorkCategoryManager>> byCategory = new LinkedHashMap<>();
        for (WorkCategoryManager assignment : workCategoryManagerRepository.findAllWithManager()) {
            byCategory.computeIfAbsent(assignment.getWorkCategory().getId(), ignored -> new ArrayList<>())
                    .add(assignment);
        }
        Map<UUID, List<WorkCategoryDirector>> directorsByCategory = directorsByCategory();
        return categories.stream()
                .map(category -> toWorkCategoryResponse(
                        category,
                        byCategory.getOrDefault(category.getId(), List.of()),
                        directorsByCategory.getOrDefault(category.getId(), List.of())))
                .toList();
    }

    @CacheEvict(cacheNames = CacheNames.WORK_CATEGORIES, allEntries = true)
    @Transactional
    public WorkCategoryResponse createWorkCategory(
            String name,
            String description,
            Integer sortOrder,
            UUID functionalUnitCategoryId,
            List<UUID> engineeringManagerManagementIds,
            List<UUID> directorManagementIds) {
        String trimmed = name.trim();
        if (workCategoryRepository.findByNameIgnoreCase(trimmed).isPresent()) {
            throw new BusinessException("DUPLICATE", "Functional unit already exists", 400);
        }
        WorkCategory category = new WorkCategory();
        category.setId(UUID.randomUUID());
        category.setName(trimmed);
        category.setDescription(trimToNull(description));
        category.setSortOrder(sortOrder != null ? sortOrder : nextWorkCategorySortOrder());
        category.setFunctionalUnitCategory(resolveFunctionalUnitCategory(functionalUnitCategoryId));
        workCategoryRepository.save(category);
        replaceWorkCategoryManagers(category, engineeringManagerManagementIds);
        replaceWorkCategoryDirectors(category, directorManagementIds);
        return toWorkCategoryResponse(
                auditNameEnricher.enrich(category),
                managersFor(category.getId()),
                directorsFor(category.getId()));
    }

    @CacheEvict(cacheNames = CacheNames.WORK_CATEGORIES, allEntries = true)
    @Transactional
    public WorkCategoryResponse updateWorkCategory(
            UUID id,
            String name,
            String description,
            Integer sortOrder,
            UUID functionalUnitCategoryId,
            List<UUID> engineeringManagerManagementIds,
            List<UUID> directorManagementIds) {
        WorkCategory category = workCategoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Functional unit not found", 404));
        String trimmed = name.trim();
        workCategoryRepository.findByNameIgnoreCase(trimmed)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new BusinessException("DUPLICATE", "Functional unit already exists", 400);
                });
        category.setName(trimmed);
        category.setDescription(trimToNull(description));
        if (sortOrder != null) {
            category.setSortOrder(sortOrder);
        }
        category.setFunctionalUnitCategory(resolveFunctionalUnitCategory(functionalUnitCategoryId));
        workCategoryRepository.save(category);
        replaceWorkCategoryManagers(category, engineeringManagerManagementIds);
        replaceWorkCategoryDirectors(category, directorManagementIds);
        return toWorkCategoryResponse(
                auditNameEnricher.enrich(category),
                managersFor(category.getId()),
                directorsFor(category.getId()));
    }

    @CacheEvict(cacheNames = CacheNames.WORK_CATEGORIES, allEntries = true)
    @Transactional
    public void deleteWorkCategory(UUID id) {
        if (!workCategoryRepository.existsById(id)) {
            throw new BusinessException("NOT_FOUND", "Functional unit not found", 404);
        }
        if (projectRepository.existsByWorkCategory_Id(id)) {
            throw new BusinessException("IN_USE", "Functional unit is assigned to one or more projects", 400);
        }
        workCategoryManagerRepository.deleteByWorkCategoryId(id);
        workCategoryDirectorRepository.deleteByWorkCategoryId(id);
        workCategoryRepository.deleteById(id);
    }

    private void replaceWorkCategoryManagers(WorkCategory category, List<UUID> managerIds) {
        workCategoryManagerRepository.deleteByWorkCategoryId(category.getId());
        if (managerIds == null || managerIds.isEmpty()) {
            return;
        }
        List<UUID> distinct = managerIds.stream().filter(id -> id != null).distinct().toList();
        for (UUID managerId : distinct) {
            TeamManagement manager = teamManagementRepository.findById(managerId)
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Engineering manager not found", 404));
            WorkCategoryManager assignment = new WorkCategoryManager();
            assignment.setId(UUID.randomUUID());
            assignment.setWorkCategory(category);
            assignment.setEngineeringManager(manager);
            workCategoryManagerRepository.save(assignment);
        }
    }

    private void replaceWorkCategoryDirectors(WorkCategory category, List<UUID> directorIds) {
        workCategoryDirectorRepository.deleteByWorkCategoryId(category.getId());
        if (directorIds == null || directorIds.isEmpty()) {
            return;
        }
        List<UUID> distinct = directorIds.stream().filter(id -> id != null).distinct().toList();
        for (UUID directorId : distinct) {
            TeamManagement director = teamManagementRepository.findById(directorId)
                    .orElseThrow(() -> new BusinessException("NOT_FOUND", "Director or VP Engineering not found", 404));
            WorkCategoryDirector assignment = new WorkCategoryDirector();
            assignment.setId(UUID.randomUUID());
            assignment.setWorkCategory(category);
            assignment.setDirector(director);
            workCategoryDirectorRepository.save(assignment);
        }
    }

    private List<WorkCategoryManager> managersFor(UUID workCategoryId) {
        return workCategoryManagerRepository.findAllWithManager().stream()
                .filter(assignment -> assignment.getWorkCategory().getId().equals(workCategoryId))
                .toList();
    }

    private List<WorkCategoryDirector> directorsFor(UUID workCategoryId) {
        return workCategoryDirectorRepository.findAllWithDirector().stream()
                .filter(assignment -> assignment.getWorkCategory().getId().equals(workCategoryId))
                .toList();
    }

    private Map<UUID, List<WorkCategoryDirector>> directorsByCategory() {
        Map<UUID, List<WorkCategoryDirector>> byCategory = new LinkedHashMap<>();
        for (WorkCategoryDirector assignment : workCategoryDirectorRepository.findAllWithDirector()) {
            byCategory.computeIfAbsent(assignment.getWorkCategory().getId(), ignored -> new ArrayList<>())
                    .add(assignment);
        }
        return byCategory;
    }

    private WorkCategoryResponse toWorkCategoryResponse(
            WorkCategory category,
            List<WorkCategoryManager> assignments,
            List<WorkCategoryDirector> directorAssignments) {
        List<WorkCategoryResponse.ManagerItem> managers = assignments.stream()
                .map(assignment -> managerItem(assignment.getEngineeringManager()))
                .sorted(Comparator.comparing(
                        WorkCategoryResponse.ManagerItem::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        List<WorkCategoryResponse.ManagerItem> directors = directorAssignments.stream()
                .map(assignment -> managerItem(assignment.getDirector()))
                .sorted(Comparator.comparing(
                        WorkCategoryResponse.ManagerItem::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        FunctionalUnitCategory group = category.getFunctionalUnitCategory();
        return WorkCategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .sortOrder(category.getSortOrder())
                .functionalUnitCategoryId(group != null ? group.getId() : null)
                .functionalUnitCategoryName(group != null ? group.getName() : null)
                .engineeringManagers(managers)
                .directors(directors)
                .createdByName(category.getCreatedByName())
                .updatedByName(category.getUpdatedByName())
                .build();
    }

    private WorkCategoryResponse.ManagerItem managerItem(TeamManagement person) {
        return WorkCategoryResponse.ManagerItem.builder()
                .id(person.getId())
                .name(person.getFullName())
                .roleTitle(person.getRoleTitle())
                .build();
    }

    private FunctionalUnitCategory resolveFunctionalUnitCategory(UUID id) {
        if (id == null) {
            return null;
        }
        return functionalUnitCategoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Functional unit category not found", 404));
    }

    private int nextWorkCategorySortOrder() {
        return workCategoryRepository.findAll().stream()
                .map(WorkCategory::getSortOrder)
                .filter(order -> order != null)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0) + 1;
    }

    @Cacheable(cacheNames = CacheNames.ISSUE_STATUSES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<IssueStatus> listIssueStatuses() {
        return issueStatusRepository.findAllByOrderBySequenceAsc();
    }

    @CacheEvict(cacheNames = CacheNames.ISSUE_STATUSES, allEntries = true)
    @Transactional
    public IssueStatus createIssueStatus(String name, int sequence, boolean terminal, String colour) {
        IssueStatus status = new IssueStatus();
        status.setId(UUID.randomUUID());
        status.setName(name.trim());
        status.setSequence(sequence);
        status.setTerminal(terminal);
        status.setColour(colour);
        return issueStatusRepository.save(status);
    }

    @CacheEvict(cacheNames = CacheNames.ISSUE_STATUSES, allEntries = true)
    @Transactional
    public IssueStatus updateIssueStatus(UUID id, String name, int sequence, boolean terminal, String colour) {
        IssueStatus status = issueStatusRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Status not found", 404));
        status.setName(name.trim());
        status.setSequence(sequence);
        status.setTerminal(terminal);
        status.setColour(colour);
        return issueStatusRepository.save(status);
    }

    @CacheEvict(cacheNames = CacheNames.ISSUE_STATUSES, allEntries = true)
    @Transactional
    public void deleteIssueStatus(UUID id) {
        issueStatusRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.PRIORITIES, key = "'admin-all'")
    @Transactional(readOnly = true)
    public List<Priority> listPriorities() {
        return priorityRepository.findAllByOrderByLevelAsc();
    }

    @CacheEvict(cacheNames = CacheNames.PRIORITIES, allEntries = true)
    @Transactional
    public Priority createPriority(String label, int level, int slaResponseHrs, int slaResolveHrs, String colour) {
        Priority priority = new Priority();
        priority.setId(UUID.randomUUID());
        priority.setLabel(label.trim());
        priority.setLevel(level);
        priority.setSlaResponseHrs(slaResponseHrs);
        priority.setSlaResolveHrs(slaResolveHrs);
        priority.setColour(colour);
        return priorityRepository.save(priority);
    }

    @CacheEvict(cacheNames = CacheNames.PRIORITIES, allEntries = true)
    @Transactional
    public Priority updatePriority(UUID id, String label, int level, int slaResponseHrs, int slaResolveHrs, String colour) {
        Priority priority = priorityRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Priority not found", 404));
        priority.setLabel(label.trim());
        priority.setLevel(level);
        priority.setSlaResponseHrs(slaResponseHrs);
        priority.setSlaResolveHrs(slaResolveHrs);
        priority.setColour(colour);
        return priorityRepository.save(priority);
    }

    @CacheEvict(cacheNames = CacheNames.PRIORITIES, allEntries = true)
    @Transactional
    public void deletePriority(UUID id) {
        priorityRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.WORK_TYPES, key = "'all'")
    @Transactional(readOnly = true)
    public List<WorkType> listWorkTypes() {
        return auditNameEnricher.enrichAll(workTypeRepository.findAll());
    }

    @CacheEvict(cacheNames = CacheNames.WORK_TYPES, allEntries = true)
    @Transactional
    public WorkType createWorkType(String name) {
        if (workTypeRepository.findAll().stream().anyMatch(w -> w.getName().equalsIgnoreCase(name.trim()))) {
            throw new BusinessException("DUPLICATE", "Work type already exists", 400);
        }
        WorkType workType = new WorkType();
        workType.setId(UUID.randomUUID());
        workType.setName(name.trim());
        return auditNameEnricher.enrich(workTypeRepository.save(workType));
    }

    @CacheEvict(cacheNames = CacheNames.WORK_TYPES, allEntries = true)
    @Transactional
    public WorkType updateWorkType(UUID id, String name) {
        WorkType workType = workTypeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Work type not found", 404));
        workType.setName(name.trim());
        return auditNameEnricher.enrich(workTypeRepository.save(workType));
    }

    @CacheEvict(cacheNames = CacheNames.WORK_TYPES, allEntries = true)
    @Transactional
    public void deleteWorkType(UUID id) {
        workTypeRepository.deleteById(id);
    }

    @Cacheable(cacheNames = CacheNames.SKILLS, key = "'all'")
    @Transactional(readOnly = true)
    public List<Skill> listSkills() {
        return auditNameEnricher.enrichAll(skillRepository.findAll());
    }

    @CacheEvict(cacheNames = CacheNames.SKILLS, allEntries = true)
    @Transactional
    public Skill createSkill(String name, String description) {
        if (skillRepository.findAll().stream().anyMatch(s -> s.getName().equalsIgnoreCase(name.trim()))) {
            throw new BusinessException("DUPLICATE", "Skill already exists", 400);
        }
        Skill skill = new Skill();
        skill.setId(UUID.randomUUID());
        skill.setName(name.trim());
        skill.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(skillRepository.save(skill));
    }

    @CacheEvict(cacheNames = CacheNames.SKILLS, allEntries = true)
    @Transactional
    public Skill updateSkill(UUID id, String name, String description) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Skill not found", 404));
        skill.setName(name.trim());
        skill.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(skillRepository.save(skill));
    }

    @CacheEvict(cacheNames = CacheNames.SKILLS, allEntries = true)
    @Transactional
    public void deleteSkill(UUID id) {
        skillRepository.deleteById(id);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private StreamResponse toStreamResponse(Stream stream) {
        Department department = stream.getDepartment();
        return StreamResponse.builder()
                .id(stream.getId())
                .name(stream.getName())
                .departmentId(department != null ? department.getId() : null)
                .departmentName(department != null ? department.getName() : null)
                .createdAt(stream.getCreatedAt())
                .updatedAt(stream.getUpdatedAt())
                .createdBy(stream.getCreatedBy())
                .updatedBy(stream.getUpdatedBy())
                .createdByName(stream.getCreatedByName())
                .updatedByName(stream.getUpdatedByName())
                .build();
    }

    private DesignationResponse toDesignationResponse(Designation designation) {
        Department department = designation.getDepartment();
        Stream stream = designation.getStream();
        return DesignationResponse.builder()
                .id(designation.getId())
                .name(designation.getName())
                .code(designation.getCode())
                .departmentId(department != null ? department.getId() : null)
                .departmentName(department != null ? department.getName() : null)
                .streamId(stream != null ? stream.getId() : null)
                .streamName(stream != null ? stream.getName() : null)
                .management(designation.isManagement())
                .createdAt(designation.getCreatedAt())
                .updatedAt(designation.getUpdatedAt())
                .createdBy(designation.getCreatedBy())
                .updatedBy(designation.getUpdatedBy())
                .createdByName(designation.getCreatedByName())
                .updatedByName(designation.getUpdatedByName())
                .build();
    }

    private ReferenceRoleResponse toRoleResponse(Role role) {
        return ReferenceRoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .code(role.getCode())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .createdBy(role.getCreatedBy())
                .updatedBy(role.getUpdatedBy())
                .createdByName(role.getCreatedByName())
                .updatedByName(role.getUpdatedByName())
                .build();
    }

    private static String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return code.trim().toUpperCase();
    }
}
