package com.nexuspm.lookup;

import com.nexuspm.lookup.entity.TaskCategory;

public final class TaskCategoryKind {

    private TaskCategoryKind() {}

    public static boolean isNonProjectRelated(TaskCategory category) {
        return isNonProjectRelated(category != null ? category.getName() : null);
    }

    public static boolean isNonProjectRelated(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String normalized = name.toLowerCase().replace('_', ' ').replace('-', ' ').replaceAll("\\s+", " ").trim();
        return normalized.contains("non project") || normalized.contains("nonproject");
    }
}
