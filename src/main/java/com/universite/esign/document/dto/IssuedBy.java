package com.universite.esign.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Agent qui établit le document, déclaré par l'application cliente (ex. Apogée) quand elle appelle l'API
 * avec son propre jeton. Ignoré si l'agent est connecté avec son compte : son jeton fait alors foi.
 */
public record IssuedBy(
        /** Identifiant de l'agent : login de l'annuaire, matricule… */
        @NotBlank @Size(max = 100) String id,
        @NotBlank @Size(max = 200) String name) {
}
