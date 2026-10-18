package com.nexuspm.lookup;

import com.nexuspm.lookup.repository.WorkCategoryManagerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkCategoryScopeService {

    private final WorkCategoryManagerRepository workCategoryManagerRepository;

    /**
     * Engineering managers assigned to the work category.
     * {@code null} means no filter. Empty list means no managers — callers should return no rows.
     */
    @Transactional(readOnly = true)
    public List<UUID> engineeringManagerIds(UUID workCategoryId) {
        if (workCategoryId == null) {
            return null;
        }
        return workCategoryManagerRepository.findManagerIdsByWorkCategoryId(workCategoryId);
    }
}
