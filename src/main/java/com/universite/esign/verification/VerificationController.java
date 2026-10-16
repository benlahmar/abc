package com.universite.esign.verification;

import java.io.IOException;

import com.universite.esign.common.BadRequestException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/verify")
@Tag(name = "Vérification (publique)")
@SecurityRequirements
class VerificationController {

    private final VerificationService service;

    VerificationController(VerificationService service) {
        this.service = service;
    }

    @GetMapping("/{code}")
    @Operation(summary = "Vérifier un document par sa référence (QR code)")
    VerificationResult byCode(@PathVariable String code) {
        return service.byCode(code);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Vérifier un fichier PDF",
            description = "Compare l'empreinte du fichier au registre et valide ses signatures PAdES.")
    VerificationResult byFile(@RequestPart("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new BadRequestException("Fichier vide");
        }
        return service.byFile(file.getBytes());
    }
}
