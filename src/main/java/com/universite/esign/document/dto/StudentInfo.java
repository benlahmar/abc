package com.universite.esign.document.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

public record StudentInfo(
        /** Code national de l'étudiant (CNE / INE). */
        @NotBlank @Size(max = 32) String cne,
        @NotBlank @Size(max = 100) String nom,
        @NotBlank @Size(max = 100) String prenom,
        @Past LocalDate dateNaissance,
        @Size(max = 100) String lieuNaissance,
        @NotBlank @Size(max = 150) String filiere,
        /** Niveau d'inscription, ex. « Licence 3 », « Master 1 ». */
        @NotBlank @Size(max = 100) String niveau) {

    public String fullName() {
        return nom.toUpperCase() + " " + prenom;
    }
}
