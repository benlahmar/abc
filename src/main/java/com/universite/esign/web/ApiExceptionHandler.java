package com.universite.esign.web;

import com.universite.esign.common.BadRequestException;
import com.universite.esign.common.ConflictException;
import com.universite.esign.common.FeatureDisabledException;
import com.universite.esign.common.NotFoundException;
import com.universite.esign.common.TooManyRequestsException;
import com.universite.esign.signature.PadesValidationService.UnsupportedDocumentException;
import java.util.List;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Erreurs au format RFC 9457 (application/problem+json). */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    /** Corps JSON valide mais champs incorrects : on liste chaque champ en erreur. */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<Map<String, Object>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(ApiExceptionHandler::toError)
                .toList();
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "La requête contient " + errors.size() + " champ(s) invalide(s)");
        problem.setProperty("errors", errors);
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    /** Paramètres invalides (ex. en-tête Idempotency-Key trop court). */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<Map<String, Object>> errors = ex.getParameterValidationResults().stream()
                .flatMap(r -> r.getResolvableErrors().stream()
                        .map(e -> Map.<String, Object>of(
                                "field", String.valueOf(r.getMethodParameter().getParameterName()),
                                "message", String.valueOf(e.getDefaultMessage()))))
                .toList();
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Paramètre(s) invalide(s)");
        problem.setProperty("errors", errors);
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    /** JSON mal formé ou valeur d'un mauvais type (ex. type de document inconnu, date mal écrite). */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Corps JSON illisible : vérifier la syntaxe, les types de valeurs et le format des dates "
                        + "(AAAA-MM-JJ). Types acceptés : ATTESTATION_SCOLARITE, RELEVE_NOTES.");
        Throwable cause = ex.getMostSpecificCause();
        if (cause != ex) {
            // Message du parseur sans le détail interne des classes Java
            problem.setProperty("cause", cause.getMessage().split("\\R")[0]);
        }
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    private static Map<String, Object> toError(FieldError e) {
        Object rejected = e.getRejectedValue();
        return rejected == null
                ? Map.of("field", e.getField(), "message", String.valueOf(e.getDefaultMessage()))
                : Map.of("field", e.getField(), "message", String.valueOf(e.getDefaultMessage()),
                        "rejectedValue", rejected);
    }

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }

    /** Refus métier (rôle de l'étape, séparation des tâches…) : 403 avec le motif. */
    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail forbidden(AccessDeniedException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(TooManyRequestsException.class)
    ProblemDetail tooMany(TooManyRequestsException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, e.getMessage());
    }

    @ExceptionHandler(FeatureDisabledException.class)
    ProblemDetail disabled(FeatureDisabledException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_IMPLEMENTED, e.getMessage());
    }

    @ExceptionHandler(ConflictException.class)
    ProblemDetail conflict(ConflictException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
    }

    /** Deux requêtes simultanées avec la même Idempotency-Key. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail integrity(DataIntegrityViolationException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "Requête concurrente en conflit, veuillez réessayer");
    }

    @ExceptionHandler({BadRequestException.class, UnsupportedDocumentException.class})
    ProblemDetail badRequest(RuntimeException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }
}
