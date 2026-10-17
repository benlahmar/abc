package com.universite.esign.registry;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface RegistryStudentRepository extends JpaRepository<RegistryStudent, Long> {

    Optional<RegistryStudent> findByAcademicYearAndCne(String academicYear, String cne);

    List<RegistryStudent> findByAcademicYear(String academicYear);

    @Query("""
            select s from RegistryStudent s where s.academicYear = :year
              and (:filiere is null or s.filiere = :filiere)
              and (:blocked = false or s.blockedAt is not null)
              and (:q is null or upper(s.cne) like :q escape '\\' or upper(s.nom) like :q escape '\\'
                   or upper(s.prenom) like :q escape '\\')
            order by s.nom, s.prenom""")
    Page<RegistryStudent> search(String year, String filiere, String q, boolean blocked, Pageable pageable);

    /** Effectifs par filière : filière, inscrits, bloqués. */
    @Query("""
            select s.filiere, count(s), sum(case when s.blockedAt is not null then 1 else 0 end)
            from RegistryStudent s where s.academicYear = :year group by s.filiere order by s.filiere""")
    List<Object[]> countsByFiliere(String year);

    @Modifying
    @Query("delete from RegistryStudent s where s.academicYear = :year")
    int deleteYear(String year);
}

interface RegistryImportRepository extends JpaRepository<RegistryImport, UUID> {

    List<RegistryImport> findByAcademicYearOrderByImportedAtDesc(String academicYear);

    @Modifying
    @Query("delete from RegistryImport i where i.academicYear = :year")
    int deleteYear(String year);
}
