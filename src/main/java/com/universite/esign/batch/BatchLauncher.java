package com.universite.esign.batch;

import java.util.EnumSet;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Exécute les lots en arrière-plan, un à la fois (le token de signature, souvent un HSM, traite les
 * signatures en série). Au démarrage, reprend les lots interrompus par un arrêt de l'application.
 */
@Component
class BatchLauncher {

    private static final Logger log = LoggerFactory.getLogger(BatchLauncher.class);

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "esign-batch");
        t.setDaemon(true);
        return t;
    });
    private final BatchProcessor processor;
    private final BatchJobRepository jobs;

    BatchLauncher(BatchProcessor processor, BatchJobRepository jobs) {
        this.processor = processor;
        this.jobs = jobs;
    }

    @TransactionalEventListener
    void onSubmitted(BatchService.BatchSubmitted event) {
        launch(event.jobId());
    }

    @EventListener(ApplicationReadyEvent.class)
    void resumeInterruptedJobs() {
        for (BatchJob job : jobs.findByStatusIn(EnumSet.of(BatchStatus.QUEUED, BatchStatus.RUNNING))) {
            log.info("Reprise du lot {} ({})", job.getId(), job.getStatus());
            launch(job.getId());
        }
    }

    private void launch(UUID jobId) {
        executor.execute(() -> {
            try {
                processor.run(jobId);
            } catch (RuntimeException e) {
                log.error("Lot {} interrompu", jobId, e);
            }
        });
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
