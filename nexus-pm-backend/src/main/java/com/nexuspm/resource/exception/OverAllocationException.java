package com.nexuspm.resource.exception;

import com.nexuspm.resource.dto.AllocationOverlapItem;
import lombok.Getter;

import java.util.List;

@Getter
public class OverAllocationException extends RuntimeException {

    private final int existingTotal;
    private final int totalWouldBe;
    private final List<AllocationOverlapItem> breakdown;

    public OverAllocationException(int existingTotal, int totalWouldBe, List<AllocationOverlapItem> breakdown) {
        super("Allocation would exceed 100% capacity (" + totalWouldBe + "%)");
        this.existingTotal = existingTotal;
        this.totalWouldBe = totalWouldBe;
        this.breakdown = breakdown;
    }
}
