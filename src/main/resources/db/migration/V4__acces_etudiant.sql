-- Accès étudiant : mode de demande en ligne par type de document (paramétrable par l'administrateur)
create table student_access_settings (
    document_type varchar(40) primary key,
    -- DISABLED : pas de demande en ligne ; AGENT : demande traitée par un agent ;
    -- AUTO : document produit immédiatement à partir de la vue Apogée
    mode          varchar(20) not null,
    -- Nombre maximal de demandes par étudiant et par jour pour ce type
    daily_limit   integer     not null
);

insert into student_access_settings (document_type, mode, daily_limit) values ('ATTESTATION_SCOLARITE', 'AGENT', 3);
insert into student_access_settings (document_type, mode, daily_limit) values ('RELEVE_NOTES', 'AGENT', 3);

-- Demandes faites par les étudiants (ENT, appli mobile, portail…)
create table student_requests (
    id               uuid primary key,
    student_cne      varchar(32)  not null,
    student_username varchar(100) not null,
    student_name     varchar(200) not null,
    document_type    varchar(40)  not null,
    academic_year    varchar(9)   not null,
    semester         varchar(10),
    purpose          varchar(40),
    status           varchar(20)  not null,
    document_id      uuid references documents (id),
    handled_by_id    varchar(100),
    handled_by_name  varchar(200),
    handled_at       timestamp with time zone,
    message          varchar(1000),
    created_at       timestamp with time zone not null,
    version          bigint       not null default 0
);

create index idx_student_requests_cne on student_requests (student_cne, created_at);
create index idx_student_requests_status on student_requests (status, created_at);
