package com.nexuspm.teamroster;

import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.teamroster.dto.ManagerAssignmentResponse;
import com.nexuspm.teamroster.entity.EmployeeManagerAssignment;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.teamroster.repository.EmployeeManagerAssignmentRepository;
import com.nexuspm.user.EmployeeRosterRefs;
import com.nexuspm.user.entity.Employee;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeManagerAssignmentService {

    public static final String SOURCE_UI = "UI";
    public static final String SOURCE_IMPORT = "IMPORT";
    public static final String SOURCE_PROMOTE = "PROMOTE";
    public static final String SOURCE_DEMOTE = "DEMOTE";

    private final EmployeeManagerAssignmentRepository assignmentRepository;
    private final EntityManager entityManager;

    /**
     * From {@code fromDate} onward the employee reports to {@code newManagerId} (null = unassigned).
     * Later history on/after that date is replaced so the current employee FK matches the open row.
     */
    @Transactional
    public void applyFromDate(Employee employee, UUID newManagerId, LocalDate fromDate, String source) {
        LocalDate today = LocalDate.now();
        LocalDate start = fromDate != null ? fromDate : today;
        if (start.isAfter(today)) {
            throw new BusinessException("VALIDATION", "Effective date cannot be in the future", 400);
        }

        List<EmployeeManagerAssignment> history =
                assignmentRepository.findByEmployee_IdOrderByFromDateAsc(employee.getId());

        EmployeeManagerAssignment covering = history.stream()
                .filter(row -> covers(row, start))
                .findFirst()
                .orElse(null);

        if (covering != null
                && Objects.equals(managerId(covering), newManagerId)
                && covering.getToDate() == null) {
            syncCurrentManager(employee, newManagerId);
            return;
        }

        history.stream()
                .filter(row -> row.getFromDate().isAfter(start))
                .forEach(assignmentRepository::delete);

        TeamManagement manager = newManagerId == null
                ? null
                : entityManager.getReference(TeamManagement.class, newManagerId);

        if (covering != null && covering.getFromDate().isEqual(start)) {
            covering.setEngineeringManager(manager);
            covering.setToDate(null);
            covering.setSource(source != null ? source : SOURCE_UI);
            assignmentRepository.save(covering);
        } else {
            if (covering != null) {
                covering.setToDate(start.minusDays(1));
                assignmentRepository.save(covering);
            }
            EmployeeManagerAssignment next = new EmployeeManagerAssignment();
            next.setId(UUID.randomUUID());
            next.setEmployee(employee);
            next.setEngineeringManager(manager);
            next.setFromDate(start);
            next.setToDate(null);
            next.setSource(source != null ? source : SOURCE_UI);
            assignmentRepository.save(next);
        }

        syncCurrentManager(employee, newManagerId);
    }

    @Transactional(readOnly = true)
    public List<ManagerAssignmentResponse> listAsOf(
            LocalDate asOf,
            UUID employeeId,
            UUID engineeringManagerManagementId,
            String search,
            boolean includeInactive) {
        LocalDate day = asOf != null ? asOf : LocalDate.now();
        String term = search != null && !search.isBlank() ? search.trim() : null;
        return assignmentRepository
                .findAsOf(day, employeeId, engineeringManagerManagementId, term, includeInactive)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ManagerAssignmentResponse> listForEmployee(UUID employeeId) {
        return assignmentRepository.findByEmployee_IdOrderByFromDateAsc(employeeId).stream()
                .map(this::toResponse)
                .toList();
    }

    public static UUID managerIdOf(Employee employee) {
        if (employee.getEngineeringManagerManagement() == null) {
            return null;
        }
        return employee.getEngineeringManagerManagement().getId();
    }

    private static boolean covers(EmployeeManagerAssignment row, LocalDate day) {
        if (row.getFromDate().isAfter(day)) {
            return false;
        }
        return row.getToDate() == null || !row.getToDate().isBefore(day);
    }

    private static UUID managerId(EmployeeManagerAssignment row) {
        return row.getEngineeringManager() == null ? null : row.getEngineeringManager().getId();
    }

    private void syncCurrentManager(Employee employee, UUID managerId) {
        if (Objects.equals(managerIdOf(employee), managerId)) {
            return;
        }
        employee.setEngineeringManagerManagement(
                managerId == null ? null : entityManager.getReference(TeamManagement.class, managerId));
    }

    private ManagerAssignmentResponse toResponse(EmployeeManagerAssignment row) {
        Employee employee = row.getEmployee();
        TeamManagement manager = row.getEngineeringManager();
        return ManagerAssignmentResponse.builder()
                .id(row.getId())
                .employeeId(employee != null ? employee.getId() : null)
                .employeeName(employee != null ? employee.getFullName() : null)
                .designationCode(employee != null ? EmployeeRosterRefs.designationCode(employee) : null)
                .designation(employee != null ? EmployeeRosterRefs.designationName(employee) : null)
                .status(employee != null ? employee.getStatus() : null)
                .engineeringManagerManagementId(manager != null ? manager.getId() : null)
                .engineeringManagerName(manager != null ? manager.getFullName() : null)
                .vpName(EmployeeRosterRefs.vpNameForManager(manager))
                .fromDate(row.getFromDate())
                .toDate(row.getToDate())
                .source(row.getSource())
                .build();
    }
}
