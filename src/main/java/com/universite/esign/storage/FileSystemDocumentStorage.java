package com.universite.esign.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;

import com.universite.esign.config.EsignProperties;
import org.springframework.stereotype.Component;

@Component
public class FileSystemDocumentStorage implements DocumentStorage {

    private final Path baseDir;

    public FileSystemDocumentStorage(EsignProperties properties) {
        this.baseDir = properties.storage().baseDir().toAbsolutePath().normalize();
    }

    @Override
    public String store(String id, byte[] content) {
        LocalDate today = LocalDate.now();
        String key = "%d/%02d/%s.pdf".formatted(today.getYear(), today.getMonthValue(), id);
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            // CREATE_NEW : un document signé n'est jamais écrasé.
            Files.write(target, content, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible d'enregistrer le document " + id, e);
        }
        return key;
    }

    @Override
    public byte[] load(String key) {
        try {
            return Files.readAllBytes(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de lire le document " + key, e);
        }
    }

    private Path resolve(String key) {
        Path path = baseDir.resolve(key).normalize();
        if (!path.startsWith(baseDir)) {
            throw new IllegalArgumentException("Clé de stockage invalide");
        }
        return path;
    }
}
