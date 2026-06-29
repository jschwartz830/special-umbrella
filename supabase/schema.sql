-- Run this in your Supabase project: SQL Editor → New Query → paste & run

create table if not exists user_store_data (
  user_id  uuid references auth.users not null,
  store_name text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, store_name)
);

alter table user_store_data enable row level security;

create policy "users can only access their own data"
  on user_store_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
