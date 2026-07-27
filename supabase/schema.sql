-- This app shares a Supabase project with the automatic-rotary-phone app.
-- Run this in that project's SQL Editor → New Query → paste & run.
-- Table name is prefixed to avoid colliding with the other app's tables.

create table if not exists workout_user_store_data (
  user_id  uuid references auth.users not null,
  store_name text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, store_name)
);

alter table workout_user_store_data enable row level security;

create policy "users can only access their own data"
  on workout_user_store_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
