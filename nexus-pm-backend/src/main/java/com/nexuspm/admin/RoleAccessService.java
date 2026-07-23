package com.nexuspm.admin;

import com.nexuspm.admin.dto.CreateAccessRoleRequest;
import com.nexuspm.admin.dto.PermissionResponse;
import com.nexuspm.admin.dto.RoleAccessResponse;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.user.entity.Permission;
import com.nexuspm.user.entity.Role;
import com.nexuspm.user.repository.EmployeeRepository;
import com.nexuspm.user.repository.PermissionRepository;
import com.nexuspm.user.repository.RoleRepository;
import com.nexuspm.shared.cache.CacheNames;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleAccessService {

    private static final Set<String> SYSTEM_ROLE_CODES = Set.of(
            "SUPER_ADMIN", "ADMIN", "CXO", "VP", "MANAGER", "EMPLOYEE");

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final EmployeeRepository employeeRepository;

    @Cacheable(cacheNames = CacheNames.PERMISSIONS, key = "'all'")
    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        return permissionRepository.findAllByOrderByModuleAscActionAsc().stream()
                .map(this::toPermissionResponse)
                .toList();
    }

    @Cacheable(cacheNames = CacheNames.ACCESS_ROLES, key = "'all'")
    @Transactional(readOnly = true)
    public List<RoleAccessResponse> listRoles() {
        return roleRepository.findAll().stream()
                .sorted((a, b) -> {
                    int order = roleSortOrder(a.getCode()) - roleSortOrder(b.getCode());
                    return order != 0 ? order : a.getName().compareToIgnoreCase(b.getName());
                })
                .map(this::toRoleAccessResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoleAccessResponse getRoleAccess(UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Role not found", 404));
        return toRoleAccessResponse(role);
    }

    @CacheEvict(cacheNames = {CacheNames.ACCESS_ROLES, CacheNames.ROLES}, allEntries = true)
    @Transactional
    public RoleAccessResponse createRole(CreateAccessRoleRequest request) {
        String name = request.getName().trim();
        String code = request.getCode().trim().toUpperCase();
        if (SYSTEM_ROLE_CODES.contains(code)) {
            throw new BusinessException("RESERVED", "That role code is reserved for a system role", 400);
        }
        if (roleRepository.findByCode(code).isPresent()) {
            throw new BusinessException("DUPLICATE", "Role code already exists", 400);
        }

        Role role = new Role();
        role.setId(UUID.randomUUID());
        role.setName(name);
        role.setCode(code);
        roleRepository.save(role);

        replacePermissions(role.getId(), request.getPermissionCodes());
        return toRoleAccessResponse(role);
    }

    @CacheEvict(cacheNames = {CacheNames.ACCESS_ROLES, CacheNames.ROLES}, allEntries = true)
    @Transactional
    public RoleAccessResponse updateRolePermissions(UUID roleId, List<String> permissionCodes) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Role not found", 404));
        if ("SUPER_ADMIN".equals(role.getCode())) {
            throw new BusinessException("PROTECTED", "Super Admin always has full access", 400);
        }

        replacePermissions(roleId, permissionCodes);
        return toRoleAccessResponse(role);
    }

    @CacheEvict(cacheNames = {CacheNames.ACCESS_ROLES, CacheNames.ROLES}, allEntries = true)
    @Transactional
    public void deleteRole(UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Role not found", 404));
        if (SYSTEM_ROLE_CODES.contains(role.getCode())) {
            throw new BusinessException("PROTECTED", "System roles cannot be deleted", 400);
        }
        if (employeeRepository.isRoleAssignedToEmployee(roleId)) {
            throw new BusinessException("IN_USE", "Role is assigned to employees and cannot be deleted", 400);
        }
        roleRepository.deletePermissionsByRoleId(roleId);
        roleRepository.delete(role);
    }

    private void replacePermissions(UUID roleId, List<String> permissionCodes) {
        List<String> normalizedCodes = permissionCodes == null ? List.of() : permissionCodes.stream()
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .distinct()
                .toList();

        roleRepository.deletePermissionsByRoleId(roleId);
        for (String code : normalizedCodes) {
            Permission permission = permissionRepository.findByCode(code)
                    .orElseThrow(() -> new BusinessException("INVALID_PERMISSION", "Unknown permission: " + code, 400));
            roleRepository.insertRolePermission(roleId, permission.getId());
        }
    }

    private RoleAccessResponse toRoleAccessResponse(Role role) {
        boolean systemRole = SYSTEM_ROLE_CODES.contains(role.getCode());
        boolean editable = !"SUPER_ADMIN".equals(role.getCode());
        return RoleAccessResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .code(role.getCode())
                .systemRole(systemRole)
                .permissionsEditable(editable)
                .deletable(!systemRole)
                .permissionCodes(roleRepository.findPermissionCodesByRoleId(role.getId()))
                .build();
    }

    private PermissionResponse toPermissionResponse(Permission permission) {
        return PermissionResponse.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .name(permission.getName())
                .module(permission.getModule())
                .action(permission.getAction())
                .build();
    }

    private static int roleSortOrder(String code) {
        return switch (code) {
            case "SUPER_ADMIN" -> 1;
            case "ADMIN" -> 2;
            case "CXO" -> 3;
            case "VP" -> 4;
            case "MANAGER" -> 5;
            case "EMPLOYEE" -> 6;
            default -> 50;
        };
    }
}
