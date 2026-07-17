package com.nexuspm.organisation.repository;

import com.nexuspm.organisation.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    List<Client> findByCountryIdOrderByNameAsc(UUID countryId);

    List<Client> findByCountryIdAndDeletedFalseOrderByNameAsc(UUID countryId);

    List<Client> findAllByDeletedFalseOrderByNameAsc();

    Optional<Client> findByIdAndDeletedFalse(UUID id);

    long countByCountryId(UUID countryId);

    @Query("SELECT c FROM Client c JOIN FETCH c.country co JOIN FETCH co.region WHERE c.id = :id")
    Optional<Client> findDetailedById(UUID id);

    List<Client> findByStatusOrderByNameAsc(String status);

    Optional<Client> findByCountryIdAndNameIgnoreCase(UUID countryId, String name);
}
