-- Run once in Supabase SQL Editor.
-- Adds customizable display names while preserving all existing polls.

alter table public.polls
  add column if not exists option_a_name text,
  add column if not exists option_b_name text;

update public.polls
set
  option_a_name = coalesce(
    nullif(btrim(option_a_name), ''),
    nullif(btrim(option_a_label), ''),
    'A'
  ),
  option_b_name = coalesce(
    nullif(btrim(option_b_name), ''),
    nullif(btrim(option_b_label), ''),
    'B'
  );

alter table public.polls
  alter column option_a_name set default 'A',
  alter column option_b_name set default 'B',
  alter column option_a_name set not null,
  alter column option_b_name set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.polls'::regclass
      and conname = 'polls_option_a_name_length_check'
  ) then
    alter table public.polls
      add constraint polls_option_a_name_length_check
      check (char_length(option_a_name) between 1 and 30);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.polls'::regclass
      and conname = 'polls_option_b_name_length_check'
  ) then
    alter table public.polls
      add constraint polls_option_b_name_length_check
      check (char_length(option_b_name) between 1 and 30);
  end if;
end;
$$;
