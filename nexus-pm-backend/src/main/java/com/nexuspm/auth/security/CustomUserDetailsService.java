package com.nexuspm.auth.security;

import com.nexuspm.auth.repository.UserAuthRepository;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.user.repository.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserAuthRepository userAuthRepository;
    private final PermissionRepository permissionRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userAuthRepository.findByEmployeeEmail(email.toLowerCase())
                .map(auth -> toPrincipal(auth.getEmployee()))
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    public UserDetails loadUserById(UUID employeeId) {
        return userAuthRepository.findByEmployeeId(employeeId)
                .map(auth -> toPrincipal(auth.getEmployee()))
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "User not found", 404));
    }

    private UserPrincipal toPrincipal(com.nexuspm.user.entity.Employee employee) {
        Set<String> permissions = new LinkedHashSet<>(permissionRepository.findPermissionCodesByEmployeeId(employee.getId()));
        return new UserPrincipal(employee, permissions);
    }
}
