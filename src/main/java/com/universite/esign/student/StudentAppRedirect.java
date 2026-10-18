package com.universite.esign.student;

import java.net.URI;

import com.universite.esign.config.EsignProperties;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Anciennes adresses de l'espace étudiant (/etudiant, /demandes), peut-être déjà en lien dans l'ENT : elles
 * redirigent vers l'application étudiante, en gardant les paramètres (?sso=1 pour la connexion directe, ?demo).
 */
@RestController
@Hidden
class StudentAppRedirect {

    private final String appUrl;

    StudentAppRedirect(EsignProperties properties) {
        String url = properties.student().appUrl();
        this.appUrl = url.endsWith("/") ? url : url + "/";
    }

    @GetMapping({"/etudiant", "/etudiant/**", "/demandes", "/demandes/**"})
    ResponseEntity<Void> redirect(HttpServletRequest request) {
        String query = request.getQueryString();
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(appUrl + (query == null ? "" : "?" + query)))
                .build();
    }
}
