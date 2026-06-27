-- Run this in the Supabase SQL editor (or via the CLI) to create/update the tables.
-- Safe to re-run: uses "if not exists" / "add column if not exists".

create table if not exists campaigns (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title      text
);

create table if not exists worlds (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  oyuncu_metni text not null,        -- the only field shown to the player
  data         jsonb not null        -- full GM/system world (atmosfer, olay_orgusu, ana_gorev, oyuncu_metni)
);

create table if not exists characters (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  world_id        uuid not null references worlds(id) on delete cascade,
  character_class text not null,
  data            jsonb not null     -- full character object
);

-- The party-gathering step: how the four characters come together, the chosen
-- main character, and the first action choices offered to the player.
create table if not exists parties (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  world_id          uuid not null references worlds(id) on delete cascade,
  campaign_id       uuid references campaigns(id) on delete cascade,
  main_character_id uuid not null references characters(id) on delete cascade,
  birlesme_metni    text not null,     -- player-facing gathering narrative
  data              jsonb not null     -- full party object (birlesme_metni + secimler)
);

create index if not exists parties_world_id_idx on parties(world_id);
create index if not exists parties_campaign_id_idx on parties(campaign_id);

-- The adventure loop: each player decision produces a scene that confronts the
-- party with a problem and offers the next decisions. Scenes chain by party.
create table if not exists scenes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  world_id    uuid not null references worlds(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  party_id    uuid not null references parties(id) on delete cascade,
  secim       jsonb not null,    -- the choice that led to this scene
  anlati      text not null,     -- player-facing narrative
  data        jsonb not null     -- full scene (anlati, ozet, secimler)
);

create index if not exists scenes_party_id_idx on scenes(party_id);
create index if not exists scenes_campaign_id_idx on scenes(campaign_id);

-- Every world and character belongs to a campaign.
alter table worlds
  add column if not exists campaign_id uuid references campaigns(id) on delete cascade;
alter table characters
  add column if not exists campaign_id uuid references campaigns(id) on delete cascade;

create index if not exists worlds_campaign_id_idx on worlds(campaign_id);
create index if not exists characters_world_id_idx on characters(world_id);
create index if not exists characters_campaign_id_idx on characters(campaign_id);
