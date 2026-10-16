package com.universite.esign.document.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RevokeRequest(
        @NotBlank @Size(max = 500) String reason,
        /** Agent qui révoque, obligatoire quand une application appelle avec son propre jeton. */
        @Valid IssuedBy by) {
}
