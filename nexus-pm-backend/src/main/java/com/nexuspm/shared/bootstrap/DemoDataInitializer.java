package com.nexuspm.shared.bootstrap;

import com.nexuspm.auth.AuthService;
import com.nexuspm.auth.entity.UserAuth;
import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.user.entity.Department;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.repository.DepartmentRepository;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DemoDataInitializer implements CommandLineRunner {

    private final EmployeeRepository employeeRepository;
    private final UserAuthRepository userAuthRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (employeeRepository.findByEmail("admin@dfnpm.local").isPresent()) {
            log.info("Demo users already exist (likely from SQL seed) — skipping app seed");
            return;
        }

        log.info("Seeding demo super admin user...");

        Department engineering = departmentRepository.findById(UUID.fromString("22222222-2222-2222-2222-222222222201"))
                .orElseThrow();
        Role superAdmin = roleRepository.findByCode("SUPER_ADMIN").orElseThrow();

        createUser("admin@dfnpm.local", "System", "Admin", "Admin@12345", engineering, superAdmin);

        log.info("Demo super admin seeded successfully");
    }

    private void createUser(String email, String firstName, String lastName, String password,
                            Department department, Role role) {
        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setEmail(email);
        employee.setFirstName(firstName);
        employee.setLastName(lastName);
        employee.setDepartment(department);
        employee.setStatus("ACTIVE");
        employee.setRoles(Set.of(role));
        employeeRepository.save(employee);

        UserAuth auth = new UserAuth();
        auth.setId(UUID.randomUUID());
        auth.setEmployee(employee);
        AuthService.applyNewPassword(auth, password, passwordEncoder);
        auth.setActive(true);
        auth.setFailedAttempts(0);
        userAuthRepository.save(auth);
    }
}
