-- Back-office FSBM : utilisateurs, sessions, catégories, circuit de publication, journal d'audit.

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL UNIQUE CHECK (email = lower(email)),
  name                  text NOT NULL,
  password_hash         text NOT NULL,
  is_admin              boolean NOT NULL DEFAULT false,
  active                boolean NOT NULL DEFAULT true,
  must_change_password  boolean NOT NULL DEFAULT false,
  failed_logins         integer NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Le jeton de session n'est jamais stocké en clair : seule son empreinte SHA-256 l'est.
CREATE TABLE sessions (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ip          text,
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  requires_review  boolean NOT NULL DEFAULT true,
  urgent_allowed   boolean NOT NULL DEFAULT false,
  lifetime_days    integer CHECK (lifetime_days IS NULL OR lifetime_days > 0),
  active           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE category_members (
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('redacteur', 'verificateur', 'validateur')),
  PRIMARY KEY (category_id, user_id, role)
);
CREATE INDEX category_members_user_idx ON category_members(user_id);

CREATE TABLE contents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text NOT NULL DEFAULT 'news',
  slug             text NOT NULL UNIQUE,
  category_id      uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title            text NOT NULL,
  excerpt          text NOT NULL DEFAULT '',
  body             jsonb NOT NULL DEFAULT '[]'::jsonb,
  image            text NOT NULL DEFAULT '',
  attachments      jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured         boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN
                     ('draft', 'changes_requested', 'in_review', 'in_validation', 'scheduled', 'published', 'archived', 'withdrawn')),
  -- Circuit figé à la soumission : un changement de configuration n'affecte pas les contenus en cours.
  requires_review  boolean NOT NULL DEFAULT true,
  publish_at       timestamptz NOT NULL DEFAULT now(),
  expire_at        timestamptz CHECK (expire_at IS NULL OR expire_at > publish_at),
  author_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  validator_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Révision d'un contenu publié : l'original reste en ligne jusqu'à la validation de la révision.
  revision_of      uuid REFERENCES contents(id) ON DELETE CASCADE,
  version          integer NOT NULL DEFAULT 1,
  trashed_at       timestamptz,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contents_status_idx ON contents(status, publish_at);
CREATE INDEX contents_category_idx ON contents(category_id);
CREATE UNIQUE INDEX contents_one_open_revision ON contents(revision_of) WHERE revision_of IS NOT NULL;

CREATE TABLE content_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  message     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_comments_content_idx ON content_comments(content_id, created_at);

-- Journal d'audit : en ajout seul, jamais modifié.
CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           text
);
CREATE INDEX audit_log_at_idx ON audit_log(at DESC);
CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id);
