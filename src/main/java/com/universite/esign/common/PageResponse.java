package com.universite.esign.common;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

/** Page de résultats, au format stable pour les clients de l'API. */
public record PageResponse<T>(List<T> items, long total, int page, int size, int totalPages) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(page.getContent().stream().map(mapper).toList(), page.getTotalElements(),
                page.getNumber(), page.getSize(), page.getTotalPages());
    }
}
