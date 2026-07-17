package com.nexuspm.user;

import com.nexuspm.auth.AuthService;
import com.nexuspm.auth.entity.UserAuth;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.teamroster.dto.ManagementUserProvisioned;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ManagementUserProvisioningService {

    private static final String EMAIL_DOMAIN = "dfnpm.local";

    private final EmployeeRepository employeeRepository;
    private final UserAuthRepository userAuthRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public List<ManagementUserProvisioned> provisionFromManagementImport(
            List<TeamManagement> management,
            Map<UUID, String> roleCodesByManagementId) {
        if (management.isEmpty()) {
            return List.of();
        }

        Set<String> reservedEmails = new HashSet<>();
        employeeRepository.findAll().stream()
                .map(Employee::getEmail)
                .filter(email -> email != null && !email.isBlank())
                .map(String::toLowerCase)
                .forEach(reservedEmails::add);

        List<ManagementUserProvisioned> created = new ArrayList<>();
        for (TeamManagement person : orderByHierarchy(management)) {
            if (employeeRepository.existsByTeamManagementId(person.getId())) {
                continue;
            }

            String roleCode = resolveRoleCode(person, roleCodesByManagementId);
            Role role = roleRepository.findByCodeWithOrgLevel(roleCode)
                    .orElseThrow(() -> new BusinessException(
                            "INVALID_ROLE",
                            "System role not found: " + roleCode,
                            400));

            String email = allocateEmail(person.getFirstName(), person.getLastName(), reservedEmails);
            String password = generateInitialPassword(person.getFirstName(), person.getLastName());

            Employee employee = new Employee();
            employee.setId(UUID.randomUUID());
            employee.setEmail(email);
            employee.setFirstName(person.getFirstName());
            employee.setLastName(person.getLastName());
            employee.setStatus("ACTIVE");
            employee.setRoles(Set.of(role));
            employee.setTeamManagement(person);
            employee.setManager(resolveManagerEmployee(person));
            employeeRepository.save(employee);

            UserAuth auth = new UserAuth();
            auth.setId(UUID.randomUUID());
            auth.setEmployee(employee);
            AuthService.applyNewPassword(auth, password, passwordEncoder);
            auth.setActive(true);
            auth.setFailedAttempts(0);
            userAuthRepository.save(auth);

            created.add(ManagementUserProvisioned.builder()
                    .managementId(person.getId())
                    .fullName(person.getFullName())
                    .email(email)
                    .roleCode(roleCode)
                    .initialPassword(password)
                    .build());
        }
        return created;
    }

    public static String generateInitialPassword(String firstName, String lastName) {
        String first = firstName != null ? firstName.trim() : "";
        String last = lastName != null ? lastName.trim() : "";
        if (first.isEmpty()) {
            throw new BusinessException("VALIDATION", "First name is required to generate a password", 400);
        }
        String initial = first.substring(0, 1).toUpperCase(Locale.ROOT);
        return initial + last + "@12345";
    }

    static String resolveRoleCode(TeamManagement person, Map<UUID, String> roleCodesByManagementId) {
        String fromSheet = roleCodesByManagementId.get(person.getId());
        if (fromSheet != null && !fromSheet.isBlank()) {
            return mapSheetRole(fromSheet.trim());
        }
        return inferRoleFromTitle(person.getRoleTitle());
    }

    static String mapSheetRole(String sheetRole) {
        String normalized = sheetRole.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        return switch (normalized) {
            case "CXO", "CPO" -> "CXO";
            case "VP" -> "VP";
            case "MANAGER", "SENIOR_MANAGER", "SR_MANAGER", "SEM", "SR_SEM" -> "MANAGER";
            default -> throw new BusinessException(
                    "IMPORT_VALIDATION",
                    "Unsupported management role \"" + sheetRole
                            + "\". Use CXO, VP, CPO, Manager, or Senior Manager.",
                    400);
        };
    }

    static String inferRoleFromTitle(String roleTitle) {
        if (roleTitle == null || roleTitle.isBlank()) {
            return "MANAGER";
        }
        String title = roleTitle.toLowerCase(Locale.ROOT);
        if (title.contains("ceo") || title.contains("cto") || title.contains("cpo") || title.contains("cxo")) {
            return "CXO";
        }
        if (title.matches(".*\\bvp\\b.*")) {
            return "VP";
        }
        // Senior Manager and Manager share the same app role / org level under VP.
        if (title.contains("manager") || title.contains("sem")) {
            return "MANAGER";
        }
        return "MANAGER";
    }

    private static String allocateEmail(String firstName, String lastName, Set<String> reservedEmails) {
        String base = sanitizeEmailPart(firstName) + "." + sanitizeEmailPart(lastName);
        if (base.equals(".")) {
            throw new BusinessException("VALIDATION", "First and last name are required to generate email", 400);
        }
        String candidate = base + "@" + EMAIL_DOMAIN;
        if (!reservedEmails.contains(candidate)) {
            reservedEmails.add(candidate);
            return candidate;
        }
        for (int suffix = 2; suffix < 1000; suffix++) {
            String withSuffix = base + suffix + "@" + EMAIL_DOMAIN;
            if (!reservedEmails.contains(withSuffix)) {
                reservedEmails.add(withSuffix);
                return withSuffix;
            }
        }
        throw new BusinessException("EMAIL_EXISTS", "Could not allocate a unique email for " + firstName + " " + lastName, 400);
    }

    private static String sanitizeEmailPart(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private Employee resolveManagerEmployee(TeamManagement person) {
        if (person.getSupervisor() == null || person.getSupervisor().getId().equals(person.getId())) {
            return null;
        }
        return employeeRepository.findByTeamManagementId(person.getSupervisor().getId()).orElse(null);
    }

    private static List<TeamManagement> orderByHierarchy(List<TeamManagement> management) {
        Map<UUID, TeamManagement> byId = new HashMap<>();
        for (TeamManagement person : management) {
            byId.put(person.getId(), person);
        }

        Map<UUID, List<TeamManagement>> childrenBySupervisor = new LinkedHashMap<>();
        List<TeamManagement> roots = new ArrayList<>();
        for (TeamManagement person : management) {
            TeamManagement supervisor = person.getSupervisor();
            if (supervisor == null || supervisor.getId().equals(person.getId())) {
                roots.add(person);
                continue;
            }
            childrenBySupervisor
                    .computeIfAbsent(supervisor.getId(), ignored -> new ArrayList<>())
                    .add(person);
        }

        List<TeamManagement> ordered = new ArrayList<>();
        Set<UUID> visited = new HashSet<>();
        ArrayDeque<TeamManagement> queue = new ArrayDeque<>(roots);
        while (!queue.isEmpty()) {
            TeamManagement current = queue.removeFirst();
            if (!visited.add(current.getId())) {
                continue;
            }
            ordered.add(current);
            for (TeamManagement child : childrenBySupervisor.getOrDefault(current.getId(), List.of())) {
                queue.addLast(child);
            }
        }

        for (TeamManagement person : management) {
            if (!visited.contains(person.getId())) {
                ordered.add(person);
            }
        }
        return ordered;
    }
}
