package com.nexuspm.auth.security;

import com.nexuspm.user.entity.Employee;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Getter
public class UserPrincipal implements UserDetails {

    private final UUID id;
    private final String email;
    private final String name;
    private final UUID departmentId;
    private final String roleCode;
    private final boolean orgWideVisibility;
    private final boolean active;
    private final Set<String> permissionCodes;

    public UserPrincipal(Employee employee, Set<String> permissionCodes) {
        this.id = employee.getId();
        this.email = employee.getEmail();
        this.name = employee.getFullName();
        this.departmentId = employee.getDepartment() != null ? employee.getDepartment().getId() : null;
        this.roleCode = employee.getPrimaryRoleCode();
        this.orgWideVisibility = employee.isOrgWideVisibility();
        this.active = "ACTIVE".equalsIgnoreCase(employee.getStatus());
        this.permissionCodes = permissionCodes != null ? permissionCodes : Set.of();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        Set<String> roles = new LinkedHashSet<>();
        roles.add("ROLE_" + roleCode);
        switch (roleCode) {
            case "SUPER_ADMIN" -> {
                roles.add("ROLE_SUPER_ADMIN");
                roles.add("ROLE_ADMIN");
                roles.add("ROLE_MANAGER");
            }
            case "ADMIN" -> {
                roles.add("ROLE_ADMIN");
                roles.add("ROLE_MANAGER");
            }
            case "MANAGER", "CXO", "VP" -> roles.add("ROLE_MANAGER");
            case "CTO", "VP_ENG", "SR_SEM", "SEM", "TECH_LEAD",
                 "PM", "PROJECT_MANAGER", "DM", "DELIVERY_MANAGER" -> roles.add("ROLE_MANAGER");
            default -> { }
        }

        Set<String> authorities = new LinkedHashSet<>(roles);
        authorities.addAll(permissionCodes);

        List<GrantedAuthority> granted = new ArrayList<>();
        for (String authority : authorities) {
            granted.add(new SimpleGrantedAuthority(authority));
        }
        return granted;
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
