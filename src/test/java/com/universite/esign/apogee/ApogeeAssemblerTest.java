package com.universite.esign.apogee;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.universite.esign.apogee.ApogeeAssembler.Assembled;
import com.universite.esign.apogee.ApogeeProperties.Field;
import com.universite.esign.document.DocumentType;
import com.universite.esign.document.dto.GradeLine;
import com.universite.esign.document.dto.IssuedBy;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class ApogeeAssemblerTest {

    private final ApogeeAssembler assembler =
            new ApogeeAssembler(Validation.buildDefaultValidatorFactory().getValidator());

    private static ApogeeRow row(int line, String cne, String module, String note) {
        Map<Field, String> v = new EnumMap<>(Field.class);
        v.put(Field.CNE, cne);
        v.put(Field.NOM, "El Amrani");
        v.put(Field.PRENOM, "Yasmine");
        v.put(Field.DATE_NAISSANCE, "14/05/2003");
        v.put(Field.FILIERE, "SMI");
        v.put(Field.NIVEAU, "Licence 3");
        v.put(Field.ANNEE, "2025");
        v.put(Field.SEMESTRE, "S5");
        v.put(Field.CODE_MODULE, module);
        v.put(Field.MODULE, "Module " + module);
        v.put(Field.NOTE, note);
        v.put(Field.CREDITS, "6");
        return new ApogeeRow(line, v);
    }

    @Test
    void groupsModulesIntoOneTranscriptPerStudent() {
        List<Assembled> result = assembler.assemble(DocumentType.RELEVE_NOTES, List.of(
                row(2, "R1", "M51", "14,5"), row(3, "R1", "M52", "9.25"), row(4, "R2", "M51", "12")),
                null, new IssuedBy("agent", "Agent"));

        assertThat(result).hasSize(2);
        Assembled first = result.getFirst();
        assertThat(first.valid()).isTrue();
        assertThat(first.lines()).isEqualTo("2-3");
        assertThat(first.request().academicYear()).isEqualTo("2025-2026");
        assertThat(first.request().student().dateNaissance()).isEqualTo(LocalDate.of(2003, 5, 14));
        assertThat(first.request().grades()).extracting(GradeLine::note)
                .containsExactly(new BigDecimal("14.5"), new BigDecimal("9.25"));
    }

    @Test
    void reportsErrorsWithLineNumbers() {
        List<Assembled> result = assembler.assemble(DocumentType.RELEVE_NOTES, List.of(
                row(2, "R1", "M51", "ABI"), row(3, "R1", "M52", "25")), null, new IssuedBy("agent", "Agent"));

        Assembled a = result.getFirst();
        assertThat(a.valid()).isFalse();
        assertThat(a.request()).isNull();
        assertThat(a.errors()).anyMatch(e -> e.startsWith("ligne 2 : note manquante ou illisible « ABI »"));
    }

    @Test
    void outOfRangeGradeIsReportedByValidation() {
        List<Assembled> result = assembler.assemble(DocumentType.RELEVE_NOTES, List.of(row(5, "R1", "M51", "25")),
                null, new IssuedBy("agent", "Agent"));
        assertThat(result.getFirst().errors()).singleElement().asString()
                .startsWith("lignes 5 : module 0 : note");
    }

    @Test
    void attestationNeedsOneLinePerStudentAndIgnoresGrades() {
        List<Assembled> result = assembler.assemble(DocumentType.ATTESTATION_SCOLARITE, List.of(
                row(2, "R1", "M51", "ABI"), row(3, "R1", "M52", "12")), null, new IssuedBy("agent", "Agent"));
        assertThat(result).singleElement().satisfies(a -> {
            assertThat(a.valid()).isTrue();
            assertThat(a.request().grades()).isNull();
            assertThat(a.request().semester()).isNull();
        });
    }

    @Test
    void parsesApogeeFormats() {
        assertThat(ApogeeAssembler.academicYear("2025")).isEqualTo("2025-2026");
        assertThat(ApogeeAssembler.academicYear("2025/26")).isEqualTo("2025-2026");
        assertThat(ApogeeAssembler.academicYear("2025-2026")).isEqualTo("2025-2026");
        assertThat(ApogeeAssembler.parseDate("2003-05-14 00:00:00")).isEqualTo(LocalDate.of(2003, 5, 14));
        assertThat(ApogeeFileParser.normalize("﻿Date de naissance ")).isEqualTo("DATE_DE_NAISSANCE");
        assertThat(ApogeeFileParser.normalize("Prénom")).isEqualTo("PRENOM");
    }
}
