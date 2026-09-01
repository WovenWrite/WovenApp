-- Run this once in the Supabase SQL editor before deploying the updated
-- utils.js / DraftEditor.jsx / CommentsDrawer.jsx.
--
-- Author-only comments for now (no reader/share-link commenting yet).
-- version_id is provenance only, NOT a staleness trigger — a comment grays
-- out only when resolved (dismissed) or orphaned (its anchor text deleted).

create table if not exists draft_comments (
  id text primary key,
  draft_id text not null,
  version_id text,               -- references draft_versions.id, nullable, no FK constraint (versions may be pruned)
  user_id uuid not null,
  author_name text,
  anchor_text text,               -- plain-text snippet of the commented selection, for display
  body text not null,
  resolved boolean default false,
  resolved_at timestamptz,
  orphaned boolean default false, -- true once the anchor span is no longer found in the draft's HTML
  created_at timestamptz default now()
);

create index if not exists draft_comments_draft_id_idx
  on draft_comments (draft_id, created_at desc);

alter table draft_comments enable row level security;

-- Same convention as draft_versions: adjust if your other tables use a
-- different user_id type.
create policy "Users manage own draft comments"
  on draft_comments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
