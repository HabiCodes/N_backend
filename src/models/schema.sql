-- ============================================================
-- WhatsApp-clone schema
-- Messages belong to a "conversation", not directly to a sender/
-- receiver pair. Costs nothing extra now, but means group chats
-- later don't require a schema rewrite.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    avatar_url      TEXT,
    is_online       BOOLEAN      NOT NULL DEFAULT false,
    last_seen_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group        BOOLEAN      NOT NULL DEFAULT false,
    name            VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT,
    message_type    VARCHAR(20) NOT NULL DEFAULT 'text', -- text | image | audio | system
    media_url       TEXT,             -- populated in Phase 2
    client_msg_id   TEXT,             -- set by the client; used to dedupe retried sends
    status          VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent | delivered | read
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participants_user
    ON conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Prevents duplicate messages if a client retries a send after a flaky connection
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conv_sender_clientmsg
    ON messages (conversation_id, sender_id, client_msg_id)
    WHERE client_msg_id IS NOT NULL;
