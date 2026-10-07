package com.nexuspm.report;

import com.nexuspm.teamroster.entity.TeamManagement;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class ManagementHierarchyUtils {

    private ManagementHierarchyUtils() {
    }

    static String normalizeName(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    public static boolean isVpRole(String roleTitle) {
        if (roleTitle == null || roleTitle.isBlank()) {
            return false;
        }
        String title = roleTitle.toLowerCase();
        return title.matches(".*\\bvp\\b.*") || title.contains("vice president");
    }

    public static boolean isCxoRole(String roleTitle) {
        if (roleTitle == null || roleTitle.isBlank()) {
            return false;
        }
        if (isVpRole(roleTitle)) {
            return false;
        }
        String title = roleTitle.toLowerCase();
        // C-suite on the management roster (CEO, COO, CTO, CPO, CXO, "Chief …")
        return title.matches(".*\\b(cxo|ceo|coo|cto|cpo)\\b.*") || title.contains("chief");
    }

    /**
     * Software Delivery Manager and similar titles on the management roster.
     */
    public static boolean isDeliveryManagerRole(String roleTitle) {
        if (roleTitle == null || roleTitle.isBlank()) {
            return false;
        }
        return roleTitle.toLowerCase().matches(".*delivery\\s*manager.*");
    }

    /**
     * COE Manager and Center/Centre of Excellence titles on the management roster.
     */
    public static boolean isCoeManagerRole(String roleTitle) {
        if (roleTitle == null || roleTitle.isBlank()) {
            return false;
        }
        String title = roleTitle.toLowerCase();
        return title.matches(".*\\bcoe\\b.*")
                || title.contains("center of excellence")
                || title.contains("centre of excellence");
    }

    /**
     * Organisation overview pillars: CXO, VP, Engineering, Delivery, COE.
     */
    public enum OrgPillar {
        CXO,
        VP,
        ENGINEERING,
        DELIVERY,
        COE
    }

    public static OrgPillar pillarFromRoleTitle(String roleTitle) {
        if (isCxoRole(roleTitle)) {
            return OrgPillar.CXO;
        }
        if (isVpRole(roleTitle)) {
            return OrgPillar.VP;
        }
        if (isDeliveryManagerRole(roleTitle)) {
            return OrgPillar.DELIVERY;
        }
        if (isCoeManagerRole(roleTitle)) {
            return OrgPillar.COE;
        }
        return OrgPillar.ENGINEERING;
    }

    /**
     * Management-roster people who count as Engineering Managers on the Dashboard.
     * Matches the product line: Senior Manager or Manager under VP (not CXO/VP/delivery/COE titles).
     */
    public static boolean isEngineeringManagerRole(String roleTitle) {
        if (roleTitle == null || roleTitle.isBlank()) {
            return false;
        }
        if (isVpRole(roleTitle)
                || isCxoRole(roleTitle)
                || isDeliveryManagerRole(roleTitle)
                || isCoeManagerRole(roleTitle)) {
            return false;
        }
        String title = roleTitle.toLowerCase();
        if (title.matches(".*engineering\\s*manager.*")) {
            return true;
        }
        if (title.contains("senior manager") || title.contains("sr manager") || title.contains("sr. manager")) {
            return true;
        }
        // e.g. "Manager", "Software Manager" — still an EM-tier person under VP
        return title.matches(".*\\bmanagers?\\b.*") || title.matches(".*\\bsem\\b.*");
    }

    static Map<String, TeamManagement> indexByName(List<TeamManagement> management) {
        Map<String, TeamManagement> byName = new HashMap<>();
        for (TeamManagement person : management) {
            byName.put(normalizeName(person.getFullName()), person);
        }
        return byName;
    }

    static Map<UUID, TeamManagement> indexById(List<TeamManagement> management) {
        Map<UUID, TeamManagement> byId = new HashMap<>();
        for (TeamManagement person : management) {
            byId.put(person.getId(), person);
        }
        return byId;
    }

    static UUID resolveSupervisorId(
            TeamManagement person,
            Map<UUID, TeamManagement> byId,
            Map<String, TeamManagement> byName) {
        if (person.getSupervisor() != null && byId.containsKey(person.getSupervisor().getId())) {
            UUID supervisorId = person.getSupervisor().getId();
            if (!supervisorId.equals(person.getId())) {
                return supervisorId;
            }
        }
        return null;
    }

    static Map<UUID, List<TeamManagement>> childrenBySupervisor(
            List<TeamManagement> management,
            Map<UUID, TeamManagement> byId,
            Map<String, TeamManagement> byName) {
        Map<UUID, List<TeamManagement>> children = new HashMap<>();
        for (TeamManagement person : management) {
            UUID supervisorId = resolveSupervisorId(person, byId, byName);
            if (supervisorId == null) {
                continue;
            }
            children.computeIfAbsent(supervisorId, ignored -> new ArrayList<>()).add(person);
        }
        return children;
    }

    static Set<UUID> collectDescendantIds(UUID rootId, Map<UUID, List<TeamManagement>> childrenBySupervisor) {
        Set<UUID> descendants = new HashSet<>();
        List<TeamManagement> queue = new ArrayList<>(childrenBySupervisor.getOrDefault(rootId, List.of()));
        while (!queue.isEmpty()) {
            TeamManagement current = queue.removeFirst();
            if (!descendants.add(current.getId())) {
                continue;
            }
            queue.addAll(childrenBySupervisor.getOrDefault(current.getId(), List.of()));
        }
        return descendants;
    }

    /**
     * Walk supervisor chain from an EM to the nearest VP-titled ancestor.
     * Returns null if none found.
     */
    public static TeamManagement resolveVpFromEngineeringManager(TeamManagement engineeringManager) {
        if (engineeringManager == null) {
            return null;
        }
        TeamManagement current = engineeringManager.getSupervisor();
        Set<UUID> visited = new HashSet<>();
        while (current != null && visited.add(current.getId())) {
            if (isVpRole(current.getRoleTitle())) {
                return current;
            }
            current = current.getSupervisor();
        }
        return null;
    }
}
