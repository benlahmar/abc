package com.universite.esign.student;

import com.universite.esign.config.EsignProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class StudentResolver {

    private final String cneClaim;

    StudentResolver(EsignProperties properties) {
        this.cneClaim = properties.student().cneClaim();
    }

    public Student resolve(Jwt jwt) {
        String cne = jwt.getClaimAsString(cneClaim);
        if (cne == null || cne.isBlank()) {
            throw new AccessDeniedException("Le compte n'est associé à aucun CNE (claim « " + cneClaim + " » absente "
                    + "du jeton) : contacter le service de scolarité");
        }
        String username = jwt.getClaimAsString("preferred_username");
        String name = jwt.getClaimAsString("name");
        username = username == null ? jwt.getSubject() : username;
        return new Student(cne.strip(), username, name == null || name.isBlank() ? username : name);
    }
}
