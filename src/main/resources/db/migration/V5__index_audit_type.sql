-- Historique du paramétrage et filtres du journal d'audit par type d'événement
create index idx_audit_type on audit_events (event_type, id);
