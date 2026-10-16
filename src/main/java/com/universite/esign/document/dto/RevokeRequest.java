package com.universite.esign.document.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RevokeRequest(@NotBlank @Size(max = 500) String reason) {
}
