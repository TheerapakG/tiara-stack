ALTER TABLE "message_checkin_member"
  ADD COLUMN IF NOT EXISTS "checkin_claim_id" varchar;

ALTER TABLE "message_room_order"
  ADD COLUMN IF NOT EXISTS "tentative" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "send_claim_id" varchar,
  ADD COLUMN IF NOT EXISTS "send_claimed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "sent_message_id" varchar,
  ADD COLUMN IF NOT EXISTS "sent_message_channel_id" varchar,
  ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "tentative_update_claim_id" varchar,
  ADD COLUMN IF NOT EXISTS "tentative_update_claimed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "tentative_pin_claim_id" varchar,
  ADD COLUMN IF NOT EXISTS "tentative_pin_claimed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "tentative_pinned_at" timestamp with time zone;
