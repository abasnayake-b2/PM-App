package com.nexuspm.admin.repository;

import com.nexuspm.admin.entity.HolidayCalendar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface HolidayCalendarRepository extends JpaRepository<HolidayCalendar, UUID> {

    @Query("""
            SELECT h FROM HolidayCalendar h
            LEFT JOIN FETCH h.country
            ORDER BY h.holidayDate ASC
            """)
    List<HolidayCalendar> findAllWithCountry();
}
