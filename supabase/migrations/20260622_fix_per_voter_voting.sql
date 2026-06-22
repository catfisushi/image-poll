-- Run this migration once in Supabase SQL Editor.
-- It removes legacy poll-wide vote uniqueness and enforces one vote per voter.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'votes'
      and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by key_position)
        from unnest(c.conkey) with ordinality as keys(attnum, key_position)
        join pg_attribute a
          on a.attrelid = c.conrelid and a.attnum = keys.attnum
      ) = array['poll_id']
  loop
    execute format(
      'alter table public.votes drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

-- Keep the earliest vote if legacy data contains duplicate voter rows.
delete from public.votes newer
using public.votes older
where newer.poll_id = older.poll_id
  and newer.voter_id = older.voter_id
  and newer.id > older.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.votes'::regclass
      and conname = 'votes_poll_id_voter_id_key'
  ) then
    alter table public.votes
      add constraint votes_poll_id_voter_id_key
      unique (poll_id, voter_id);
  end if;
end;
$$;

update public.polls p
set
  votes_a = (
    select count(*)
    from public.votes v
    where v.poll_id = p.id and v.choice = 'A'
  ),
  votes_b = (
    select count(*)
    from public.votes v
    where v.poll_id = p.id and v.choice = 'B'
  );

drop function if exists public.cast_poll_vote(text, text, text);

create function public.cast_poll_vote(
  p_poll_id text,
  p_voter_id text,
  p_choice text
)
returns table (
  duplicate boolean,
  saved_choice text,
  votes_a bigint,
  votes_b bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if p_choice not in ('A', 'B') then
    raise exception 'Invalid vote choice' using errcode = '22023';
  end if;

  if not exists (select 1 from public.polls where id = p_poll_id) then
    raise exception 'Poll not found' using errcode = 'P0002';
  end if;

  insert into public.votes (poll_id, voter_id, choice)
  values (p_poll_id, p_voter_id, p_choice)
  on conflict (poll_id, voter_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.polls as target
    set
      votes_a = target.votes_a + case when p_choice = 'A' then 1 else 0 end,
      votes_b = target.votes_b + case when p_choice = 'B' then 1 else 0 end
    where target.id = p_poll_id;

    return query
      select false, p_choice, p.votes_a, p.votes_b
      from public.polls p
      where p.id = p_poll_id;
  else
    return query
      select true, v.choice, p.votes_a, p.votes_b
      from public.votes v
      join public.polls p on p.id = v.poll_id
      where v.poll_id = p_poll_id
        and v.voter_id = p_voter_id;
  end if;
end;
$$;

revoke all on function public.cast_poll_vote(text, text, text)
  from public, anon, authenticated;
grant execute on function public.cast_poll_vote(text, text, text)
  to service_role;
