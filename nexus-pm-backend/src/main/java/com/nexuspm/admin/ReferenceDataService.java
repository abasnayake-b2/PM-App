package com.nexuspm.admin;

import com.nexuspm.lookup.IssueTypeCatalog;
import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
    private final IssueStatusRepository issueStatusRepository;
    private final PriorityRepository priorityRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditNameEnricher auditNameEnricher;

    private static final Set<String> SYSTEM_ROLE_CODES = Set.of(
            "SUPER_ADMIN", "ADMIN", "CXO", "VP", "MANAGER", "EMPLOYEE");

    @Transactional(readOnly = true)
    public List<Department> listDepartments() {
        return auditNameEnricher.enrichAll(departmentRepository.findAll());
    }

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

    @Transactional
    public Department updateDepartment(UUID id, String name) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Department not found", 404));
        department.setName(name.trim());
        return auditNameEnricher.enrich(departmentRepository.save(department));
    }

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

    @Transactional(readOnly = true)
    public List<StreamResponse> listStreams() {
        List<Stream> streams = streamRepository.findAllWithDepartment();
        auditNameEnricher.enrichAll(streams);
        return streams.stream().map(this::toStreamResponse).toList();
    }

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

    @Transactional
    public void deleteStream(UUID id) {
        if (designationRepository.existsByStream_Id(id)) {
            throw new BusinessException("IN_USE", "Stream is assigned to designations", 400);
        }
        streamRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<DesignationResponse> listDesignations() {
        List<Designation> designations = designationRepository.findAllWithDepartment();
        auditNameEnricher.enrichAll(designations);
        return designations.stream().map(this::toDesignationResponse).toList();
    }

    @Transactional
    public DesignationResponse createDesignation(String name, String code, UUID streamId) {
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
        return toDesignationResponse(auditNameEnricher.enrich(designationRepository.save(designation)));
    }

    @Transactional
    public DesignationResponse updateDesignation(UUID id, String name, String code, UUID streamId) {
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
        return toDesignationResponse(auditNameEnricher.enrich(designationRepository.save(designation)));
    }

    @Transactional
    public void deleteDesignation(UUID id) {
        if (employeeRepository.findAll().stream().anyMatch(e -> e.getDesignation() != null && e.getDesignation().getId().equals(id))) {
            throw new BusinessException("IN_USE", "Designation is assigned to employees", 400);
        }
        designationRepository.deleteById(id);
    }

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

    @Transactional
    public ReferenceRoleResponse createRole(String name, String code) {
        throw new BusinessException("NOT_ALLOWED", "Create roles under Admin → Roles & access.", 400);
    }

    @Transactional
    public ReferenceRoleResponse updateRole(UUID id, String name) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Role not found", 404));
        role.setName(name.trim());
        return toRoleResponse(auditNameEnricher.enrich(roleRepository.save(role)));
    }

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

    @Transactional(readOnly = true)
    public List<IssueType> listIssueTypes() {
        return IssueTypeCatalog.filterAndSort(issueTypeRepository.findAll());
    }

    @Transactional
    public IssueType createIssueType(String name, String workflowCode, String description) {
        IssueType issueType = new IssueType();
        issueType.setId(UUID.randomUUID());
        issueType.setName(name.trim());
        issueType.setWorkflowCode(workflowCode.trim().toUpperCase());
        issueType.setDescription(description);
        return issueTypeRepository.save(issueType);
    }

    @Transactional
    public IssueType updateIssueType(UUID id, String name, String workflowCode, String description) {
        IssueType issueType = issueTypeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue type not found", 404));
        issueType.setName(name.trim());
        issueType.setWorkflowCode(workflowCode.trim().toUpperCase());
        issueType.setDescription(description);
        return issueTypeRepository.save(issueType);
    }

    @Transactional
    public void deleteIssueType(UUID id) {
        issueTypeRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<IssueStatus> listIssueStatuses() {
        return issueStatusRepository.findAllByOrderBySequenceAsc();
    }

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

    @Transactional
    public void deleteIssueStatus(UUID id) {
        issueStatusRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<Priority> listPriorities() {
        return priorityRepository.findAllByOrderByLevelAsc();
    }

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

    @Transactional
    public void deletePriority(UUID id) {
        priorityRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<WorkType> listWorkTypes() {
        return auditNameEnricher.enrichAll(workTypeRepository.findAll());
    }

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

    @Transactional
    public WorkType updateWorkType(UUID id, String name) {
        WorkType workType = workTypeRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Work type not found", 404));
        workType.setName(name.trim());
        return auditNameEnricher.enrich(workTypeRepository.save(workType));
    }

    @Transactional
    public void deleteWorkType(UUID id) {
        workTypeRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<Skill> listSkills() {
        return auditNameEnricher.enrichAll(skillRepository.findAll());
    }

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

    @Transactional
    public Skill updateSkill(UUID id, String name, String description) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Skill not found", 404));
        skill.setName(name.trim());
        skill.setDescription(trimToNull(description));
        return auditNameEnricher.enrich(skillRepository.save(skill));
    }

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
