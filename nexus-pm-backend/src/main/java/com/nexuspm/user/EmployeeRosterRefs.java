package com.nexuspm.user;

import com.nexuspm.organisation.entity.Country;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.user.entity.Designation;
import com.nexuspm.user.entity.Employee;
import com.nexuspm.user.entity.Stream;
import com.nexuspm.user.entity.WorkType;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Resolves roster display values from employee foreign keys.
 */
public final class EmployeeRosterRefs {

    private EmployeeRosterRefs() {
    }

    public static String designationCode(Employee employee) {
        Designation designation = employee.getDesignation();
        if (designation != null && designation.getCode() != null && !designation.getCode().isBlank()) {
            return designation.getCode().trim();
        }
        return null;
    }

    public static String designationName(Employee employee) {
        Designation designation = employee.getDesignation();
        if (designation != null && designation.getName() != null && !designation.getName().isBlank()) {
            return designation.getName().trim();
        }
        return designationCode(employee);
    }

    public static String teamName(Employee employee) {
        Stream stream = employee.getStream();
        if (stream != null && stream.getName() != null && !stream.getName().isBlank()) {
            return stream.getName().trim();
        }
        Designation designation = employee.getDesignation();
        if (designation != null) {
            Stream designationStream = designation.getStream();
            if (designationStream != null && designationStream.getName() != null
                    && !designationStream.getName().isBlank()) {
                return designationStream.getName().trim();
            }
        }
        return null;
    }

    public static String engineeringManagerName(Employee employee) {
        TeamManagement manager = employee.getEngineeringManagerManagement();
        if (manager != null) {
            return manager.getFullName();
        }
        return null;
    }

    /**
     * Walks the management supervisor chain from the employee's EM up to the first VP title.
     */
    public static String vpName(Employee employee) {
        return vpNameForManager(employee.getEngineeringManagerManagement());
    }

    public static String vpNameForManager(TeamManagement start) {
        if (start == null) {
            return null;
        }
        TeamManagement current = start;
        Set<UUID> seen = new HashSet<>();
        while (current != null && seen.add(current.getId())) {
            if (isVpRoleTitle(current.getRoleTitle())) {
                return current.getFullName();
            }
            current = current.getSupervisor();
        }
        return null;
    }

    private static boolean isVpRoleTitle(String roleTitle) {
        return roleTitle != null && roleTitle.toLowerCase(Locale.ROOT).matches(".*\\bvp\\b.*");
    }

    public static String workTypeName(Employee employee) {
        WorkType workType = employee.getWorkType();
        if (workType != null && workType.getName() != null && !workType.getName().isBlank()) {
            return workType.getName().trim();
        }
        return null;
    }

    public static String countryLabel(Employee employee) {
        Country country = employee.getCountry();
        if (country == null) {
            return null;
        }
        if (country.getName() != null && !country.getName().isBlank()) {
            return country.getName().trim();
        }
        if (country.getCode() != null && !country.getCode().isBlank()) {
            return country.getCode().trim();
        }
        return null;
    }
}
