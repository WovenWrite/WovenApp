-- Run this once in the Supabase SQL editor before deploying the updated
-- utils.js / DraftEditor.jsx / VersionsDrawer.jsx.
--
-- Replaces the old localStorage + wf_data-blob version history with a real
-- table: one row per snapshot, so autosave cadence and pruning can operate
-- per-row instead of rewriting a whole JSON array on every save.

create table if not exists draft_versions (
  id text primary key,
  draft_id text not null,
  user_id uuid not null,
  body text not null,
  word_count integer default 0,
  is_manual boolean default false,
  label text,
  created_at timestamptz default now()
);

-- Speeds up "get recent snapshots for this draft" (VersionsDrawer) and the
-- prune query (utils.js pruneSnapshots), both of which filter by draft_id
-- and sort by created_at.
create index if not exists draft_versions_draft_id_idx
  on draft_versions (draft_id, created_at desc);

alter table draft_versions enable row level security;

-- NOTE: this assumes user_id is a uuid matching auth.uid(), matching the
-- pattern used elsewhere in the app (window.__wovenUserId). If your other
-- tables use a different user_id type/convention, adjust this policy to match.
create policy "Users manage own draft versions"
  on draft_versions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
