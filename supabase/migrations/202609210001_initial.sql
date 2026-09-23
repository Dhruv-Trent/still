create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 timezone text not null default 'UTC', locale text not null default 'en' check(locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$' and length(locale)<=40),
 theme text not null default 'system' check(theme in ('light','dark','system')),
 week_start integer not null default 1 check(week_start in (0,1)),
 version integer not null default 1, updated_at timestamptz not null default now()
);
create table public.task_lists (
 id uuid primary key, user_id uuid not null references auth.users on delete cascade,
 name text not null check(length(trim(name)) between 1 and 80), position integer not null default 0 check(position>=0),
 version integer not null default 1, deleted_at timestamptz, unique(id,user_id)
);
create table public.task_series (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 template jsonb not null, anchor_index integer not null default 0, expanded_at timestamptz not null default now(), active boolean not null default true, unique(id,user_id)
);
create table public.tasks (
 id uuid primary key, user_id uuid not null references auth.users on delete cascade,
 list_id uuid, title text not null check(length(trim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=10000), priority integer not null default 0 check(priority between 0 and 3),
 status text not null default 'open' check(status in ('open','completed')), scheduled_at timestamptz, due_at timestamptz,
 timezone text not null default 'UTC', completed_at timestamptz, position integer not null default 0 check(position>=0),
 recurrence jsonb, reminder_offsets integer[] not null default '{}', custom_reminders timestamptz[] not null default '{}',
 series_id uuid, occurrence_index integer not null default 0, version integer not null default 1,
 deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id), unique(series_id,occurrence_index),
 foreign key(list_id,user_id) references public.task_lists(id,user_id),
 foreign key(series_id,user_id) references public.task_series(id,user_id),
 check(cardinality(reminder_offsets)<=10 and cardinality(custom_reminders)<=10),
 check(0<=all(reminder_offsets) and 525600>=all(reminder_offsets)),
 check((recurrence is null and cardinality(reminder_offsets)=0) or coalesce(scheduled_at,due_at) is not null)
);
create table public.reminders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 task_id uuid not null, reminder_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled','no_subscription','missed')),
 attempts integer not null default 0, lease_until timestamptz, sent_at timestamptz,
 unique(task_id,reminder_at), foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 endpoint text not null unique check(length(endpoint)<2048), p256dh text not null, auth text not null,
 created_at timestamptz not null default now()
);
create table public.mutation_receipts (
 id uuid primary key, user_id uuid not null references auth.users on delete cascade,
 payload jsonb not null, result jsonb not null, created_at timestamptz not null default now()
);
create table public.rate_limits (key text primary key, bucket timestamptz not null, count integer not null);
create table public.scheduler_health (id boolean primary key default true check(id), last_run timestamptz not null);
create index tasks_owner_dates on public.tasks(user_id,scheduled_at,due_at) where deleted_at is null;
create index lists_owner on public.task_lists(user_id,position);
create index reminders_due on public.reminders(reminder_at) where status in ('pending','sending');
create index subscriptions_owner on public.push_subscriptions(user_id);
create index receipts_owner on public.mutation_receipts(user_id);

alter table public.profiles enable row level security;
alter table public.task_lists enable row level security;
alter table public.task_series enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.mutation_receipts enable row level security;
alter table public.rate_limits enable row level security;
alter table public.scheduler_health enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_lists on public.task_lists for select to authenticated using(user_id=auth.uid());
create policy own_series on public.task_series for select to authenticated using(user_id=auth.uid());
create policy own_tasks on public.tasks for select to authenticated using(user_id=auth.uid());
create policy own_reminders on public.reminders for select to authenticated using(user_id=auth.uid());
create policy own_subscriptions on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy own_receipts on public.mutation_receipts for select to authenticated using(user_id=auth.uid());
revoke all on public.profiles,public.task_lists,public.task_series,public.tasks,public.reminders,public.push_subscriptions,public.mutation_receipts,public.rate_limits,public.scheduler_health from anon,authenticated;
grant select on public.profiles,public.task_lists,public.task_series,public.tasks,public.reminders,public.push_subscriptions,public.mutation_receipts to authenticated;
grant all on public.profiles,public.task_lists,public.task_series,public.tasks,public.reminders,public.push_subscriptions,public.mutation_receipts,public.rate_limits,public.scheduler_health to service_role;

create function public.validate_subscription_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'subscription owner is immutable';end if;
 if tg_op='INSERT' and (select count(*) from public.push_subscriptions where user_id=new.user_id)>=10 then raise exception 'notification device limit reached';end if;
 return new;
end $$;
revoke all on function public.validate_subscription_limit() from public,anon,authenticated;
create trigger subscription_limit before insert or update on public.push_subscriptions for each row execute function public.validate_subscription_limit();

create function public.take_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer; begin
 insert into public.rate_limits(key,bucket,count) values(p_key,now(),1)
 on conflict(key) do update set count=case when public.rate_limits.bucket<now()-make_interval(secs=>p_window) then 1 else public.rate_limits.count+1 end,
 bucket=case when public.rate_limits.bucket<now()-make_interval(secs=>p_window) then now() else public.rate_limits.bucket end returning count into n;
 return n<=p_limit; end $$;
revoke all on function public.take_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.take_rate_limit(text,integer,integer) to service_role;

create function public.next_occurrence(p_at timestamptz,p_zone text,p_rule jsonb) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare d timestamp:=p_at at time zone p_zone; f text:=p_rule->>'frequency'; n integer:=(p_rule->>'interval')::integer; begin
 if f='daily' then d:=d+make_interval(days=>n);
 elsif f='weekly' then d:=d+make_interval(days=>7*n);
 elsif f='monthly' then d:=d+make_interval(months=>n);
 elsif f='yearly' then d:=d+make_interval(years=>n);
 else loop d:=d+interval '1 day'; exit when (f='weekdays' and extract(isodow from d)<=5) or (f='custom' and (p_rule->'weekdays')@>to_jsonb(array[extract(isodow from d)::integer])); end loop; end if;
 return d at time zone p_zone; end $$;

create function public.validate_task() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'invalid timezone'; end if;
 if new.recurrence is not null then
 if jsonb_typeof(new.recurrence)<>'object' or (new.recurrence->>'frequency') not in ('daily','weekdays','weekly','monthly','yearly','custom') or (new.recurrence->>'frequency') is null or coalesce((new.recurrence->>'interval')::integer,0) not between 1 and 365 then raise exception 'invalid recurrence'; end if;
 if jsonb_typeof(new.recurrence->'weekdays') is distinct from 'array' then raise exception 'invalid weekdays'; end if;
 if exists(select 1 from jsonb_array_elements_text(new.recurrence->'weekdays') v where v::integer not between 1 and 7) or jsonb_array_length(new.recurrence->'weekdays')>7 or (new.recurrence->>'frequency'='custom' and jsonb_array_length(new.recurrence->'weekdays')=0) then raise exception 'invalid weekdays'; end if;
 end if;
 return new; end $$;
create trigger validate_task before insert or update on public.tasks for each row execute function public.validate_task();

create function public.schedule_reminders() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.reminders set status='cancelled' where task_id=new.id and status in ('pending','sending','failed','no_subscription');
 if new.status='open' and new.deleted_at is null then
 insert into public.reminders(user_id,task_id,reminder_at,status)
 select new.user_id,new.id,notify_at,case when notify_at<now()-interval '1 hour' then 'missed' else 'pending' end from (select coalesce(new.scheduled_at,new.due_at)-make_interval(mins=>m) notify_at from unnest(new.reminder_offsets) m union select unnest(new.custom_reminders)) times where notify_at is not null
 on conflict(task_id,reminder_at) do update set status=case when public.reminders.status='sent' then 'sent' else excluded.status end,attempts=0,lease_until=null;
 end if; return new; end $$;
create trigger schedule_reminders after insert or update on public.tasks for each row execute function public.schedule_reminders();

create function public.occurrence_at(p_at timestamptz,p_zone text,p_rule jsonb,p_index integer) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare d timestamp:=p_at at time zone p_zone; f text:=p_rule->>'frequency'; n integer:=(p_rule->>'interval')::integer; i integer; direction integer:=case when p_index<0 then -1 else 1 end;
begin
 if abs(p_index)>100000 then raise exception 'series limit';end if;
 if f='daily' then d:=d+make_interval(days=>n*p_index);
 elsif f='weekly' then d:=d+make_interval(days=>7*n*p_index);
 elsif f='monthly' then d:=d+make_interval(months=>n*p_index);
 elsif f='yearly' then d:=d+make_interval(years=>n*p_index);
 else for i in 1..abs(p_index) loop loop d:=d+make_interval(days=>direction);exit when (f='weekdays' and extract(isodow from d)<=5) or (f='custom' and (p_rule->'weekdays')@>to_jsonb(array[extract(isodow from d)::integer]));end loop;end loop;end if;
 return d at time zone p_zone;
end $$;
revoke all on function public.occurrence_at(timestamptz,text,jsonb,integer) from public,anon,authenticated;

create function public.materialize_next(p_task uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks; s public.task_series; n integer; i integer; base_at timestamptz; new_at timestamptz; new_due timestamptz; local_at timestamp; zone text; rule jsonb; d jsonb;
begin
 select * into t from public.tasks where id=p_task;
 if t.series_id is null then return;end if;
 select * into s from public.task_series where id=t.series_id and user_id=t.user_id and active for update;
 if not found then return;end if;
 d:=s.template;rule:=d->'recurrence';zone:=d->>'timezone';
 if rule is null or rule='null'::jsonb then return;end if;
 n:=t.occurrence_index+1-s.anchor_index;if n<=0 then return;end if;
 base_at:=coalesce((d->>'scheduled_at')::timestamptz,(d->>'due_at')::timestamptz);local_at:=base_at at time zone zone;
 new_at:=public.occurrence_at(base_at,zone,rule,n);
 if d->>'due_at' is not null then new_due:=((new_at at time zone zone)+(((d->>'due_at')::timestamptz at time zone zone)-local_at)) at time zone zone;end if;
 insert into public.tasks(id,user_id,title,description,priority,list_id,scheduled_at,due_at,timezone,reminder_offsets,status,position,recurrence,series_id,occurrence_index)
 values(gen_random_uuid(),t.user_id,d->>'title',d->>'description',(d->>'priority')::integer,(d->>'list_id')::uuid,case when d->>'scheduled_at' is not null then new_at end,new_due,zone,array(select jsonb_array_elements_text(d->'reminder_offsets')::integer),'open',t.position,rule,t.series_id,t.occurrence_index+1)
 on conflict(series_id,occurrence_index) do nothing;
end $$;
revoke all on function public.materialize_next(uuid) from public,anon,authenticated;

create function public.apply_mutation(m jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); rid uuid:=(m->>'record_id')::uuid; mid uuid:=(m->>'id')::uuid;
 e text:=m->>'entity'; a text:=m->>'action'; scope text:=coalesce(m->>'scope','one'); d jsonb:=m->'data';
 expected integer:=(m->>'expected_version')::integer; old public.tasks; t public.tasks; l public.task_lists; p public.profiles; receipt public.mutation_receipts;
 result jsonb; sid uuid; new_at timestamptz; base_at timestamptz; tmpl jsonb; idx integer;
begin
 if uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
 if octet_length(m::text)>32768 then raise exception 'request too large'; end if;
 if not public.take_rate_limit('mutation:'||uid,180,60) then raise exception 'rate limited' using errcode='P0003'; end if;
 if e not in ('task','list','profile') or a not in ('put','delete') or scope not in ('one','future','series') or expected is null or expected<0 then raise exception 'invalid mutation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into receipt from public.mutation_receipts where id=mid;
 if found then if receipt.user_id<>uid or receipt.payload<>m then raise exception 'invalid mutation id' using errcode='42501'; end if;return receipt.result;end if;
 if e='task' then
 select * into old from public.tasks where id=rid for update;
 if found and old.user_id<>uid then raise exception 'access denied' using errcode='42501';end if;
 if coalesce(old.version,0)<>expected or old.deleted_at is not null then raise exception 'conflict' using errcode='40001';end if;
 if a='delete' then
 if old.id is null then raise exception 'not found';end if;
 update public.tasks set deleted_at=now(),version=version+1,updated_at=now() where user_id=uid and (id=rid or (scope<>'one' and old.series_id is not null and series_id=old.series_id and (scope='series' or occurrence_index>=old.occurrence_index)));
 if scope<>'one' then update public.task_series set active=false where id=old.series_id and user_id=uid;else perform public.materialize_next(rid);end if;
 else
 if d - array['title','description','priority','list_id','scheduled_at','due_at','timezone','reminder_offsets','custom_reminders','status','position','recurrence'] <> '{}'::jsonb then raise exception 'unexpected fields';end if;
 if d->>'list_id' is not null and not exists(select 1 from public.task_lists where id=(d->>'list_id')::uuid and user_id=uid and deleted_at is null) then raise exception 'access denied' using errcode='42501';end if;
 if old.series_id is not null and scope='one' and nullif(d->'recurrence','null'::jsonb) is distinct from old.recurrence then raise exception 'change recurrence with future or series scope';end if;
 sid:=old.series_id;
 if sid is not null and d->'recurrence'<>'null'::jsonb and not exists(select 1 from public.task_series where id=sid and active) then sid:=null;end if;
 if d->'recurrence' is not null and d->'recurrence'<>'null'::jsonb and sid is null then insert into public.task_series(user_id,template,anchor_index) values(uid,d,coalesce(old.occurrence_index,0)) returning id into sid;end if;
 insert into public.tasks(id,user_id,title,description,priority,list_id,scheduled_at,due_at,timezone,reminder_offsets,custom_reminders,status,position,recurrence,completed_at,series_id)
 values(rid,uid,d->>'title',d->>'description',(d->>'priority')::integer,(d->>'list_id')::uuid,(d->>'scheduled_at')::timestamptz,(d->>'due_at')::timestamptz,d->>'timezone',array(select jsonb_array_elements_text(d->'reminder_offsets')::integer),array(select jsonb_array_elements_text(d->'custom_reminders')::timestamptz),d->>'status',(d->>'position')::integer,nullif(d->'recurrence','null'::jsonb),case when d->>'status'='completed' then coalesce(old.completed_at,now()) end,sid)
 on conflict(id) do update set title=excluded.title,description=excluded.description,priority=excluded.priority,list_id=excluded.list_id,scheduled_at=excluded.scheduled_at,due_at=excluded.due_at,timezone=excluded.timezone,reminder_offsets=excluded.reminder_offsets,custom_reminders=excluded.custom_reminders,status=excluded.status,position=excluded.position,recurrence=excluded.recurrence,completed_at=excluded.completed_at,series_id=excluded.series_id,version=public.tasks.version+1,updated_at=now()
 returning * into t;
 if sid is not null and scope<>'one' then
 update public.task_series set template=d,anchor_index=t.occurrence_index,active=t.recurrence is not null where id=sid and user_id=uid;
 update public.tasks set title=t.title,description=t.description,priority=t.priority,list_id=t.list_id,timezone=t.timezone,recurrence=t.recurrence,reminder_offsets=t.reminder_offsets,
 scheduled_at=case when t.recurrence is not null and t.scheduled_at is not null then public.occurrence_at(t.scheduled_at,t.timezone,t.recurrence,occurrence_index-t.occurrence_index) else scheduled_at end,
 due_at=case when t.recurrence is not null and t.due_at is not null then public.occurrence_at(t.due_at,t.timezone,t.recurrence,occurrence_index-t.occurrence_index) else due_at end,
 deleted_at=case when t.recurrence is null and occurrence_index>t.occurrence_index then now() else deleted_at end,
 version=version+1,updated_at=now()
 where series_id=sid and user_id=uid and id<>rid and deleted_at is null and (scope='series' or occurrence_index>=old.occurrence_index);
 end if;
 if t.status='completed' and coalesce(old.status,'open')='open' and sid is not null then perform public.materialize_next(rid);end if;
 end if;
 elsif e='list' then
 select * into l from public.task_lists where id=rid for update;
 if found and l.user_id<>uid then raise exception 'access denied' using errcode='42501';end if;
 if coalesce(l.version,0)<>expected or l.deleted_at is not null then raise exception 'conflict' using errcode='40001';end if;
 if a='delete' then
 if l.id is null then raise exception 'not found';end if;
 update public.tasks set list_id=null,version=version+1 where list_id=rid and user_id=uid;
 update public.task_series set template=jsonb_set(template,'{list_id}','null'::jsonb) where user_id=uid and template->>'list_id'=rid::text;
 update public.task_lists set deleted_at=now(),version=version+1 where id=rid;
 else
 if d-array['name','position']<>'{}'::jsonb then raise exception 'unexpected fields';end if;
 insert into public.task_lists(id,user_id,name,position) values(rid,uid,d->>'name',(d->>'position')::integer) on conflict(id) do update set name=excluded.name,position=excluded.position,version=public.task_lists.version+1;
 end if;
 else
 if rid<>uid or a<>'put' then raise exception 'access denied' using errcode='42501';end if;
 select * into p from public.profiles where id=uid for update;
 if coalesce(p.version,0)<>expected then raise exception 'conflict' using errcode='40001';end if;
 if d-array['display_name','timezone','theme','week_start','locale']<>'{}'::jsonb or not exists(select 1 from pg_timezone_names where name=d->>'timezone') or length(d->>'locale')>40 then raise exception 'invalid profile';end if;
 insert into public.profiles(id,display_name,timezone,theme,week_start,locale) values(uid,d->>'display_name',d->>'timezone',d->>'theme',(d->>'week_start')::integer,d->>'locale') on conflict(id) do update set display_name=excluded.display_name,timezone=excluded.timezone,theme=excluded.theme,week_start=excluded.week_start,locale=excluded.locale,version=public.profiles.version+1,updated_at=now();
 end if;
 result:=jsonb_build_object('ok',true);
 insert into public.mutation_receipts(id,user_id,payload,result) values(mid,uid,m,result);
 return result; end $$;
revoke all on function public.apply_mutation(jsonb) from public,anon;
grant execute on function public.apply_mutation(jsonb) to authenticated;

create function public.expand_recurrences() returns integer language plpgsql security definer set search_path='' as $$
declare s public.task_series; t public.tasks; i integer; processed integer:=0;
begin
 for s in select * from public.task_series where active order by expanded_at for update skip locked limit 100 loop
 for i in 1..64 loop
 select * into t from public.tasks where series_id=s.id order by occurrence_index desc limit 1;
 exit when not found or coalesce(t.scheduled_at,t.due_at)>now()+interval '32 days';
 perform public.materialize_next(t.id);
 end loop;
 update public.task_series set expanded_at=now() where id=s.id;
 processed:=processed+1;
 end loop;return processed;
end $$;
revoke all on function public.expand_recurrences() from public,anon,authenticated;
grant execute on function public.expand_recurrences() to service_role;

create function public.claim_reminders() returns setof public.reminders language plpgsql security definer set search_path='' as $$
begin
 update public.reminders set status='failed' where status='sending' and lease_until<now() and attempts>=5;
 insert into public.scheduler_health(id,last_run) values(true,now()) on conflict(id) do update set last_run=now();
 return query with candidates as (
 select id from public.reminders where reminder_at<=now() and attempts<5 and (status='pending' and (lease_until is null or lease_until<now()) or status='sending' and lease_until<now()) order by reminder_at for update skip locked limit 20
 ) update public.reminders r set status='sending',lease_until=now()+interval '5 minutes',attempts=attempts+1 from candidates c where r.id=c.id returning r.*;
 end $$;
revoke all on function public.claim_reminders() from public,anon,authenticated;
grant execute on function public.claim_reminders() to service_role;

-- Avoid anonymous RPC access to internal trigger helpers.
revoke all on function public.schedule_reminders(),public.validate_task(),public.next_occurrence(timestamptz,text,jsonb) from public,anon,authenticated;
-- Realtime sends only rows allowed by the subscriber's SELECT policy.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.tasks,public.task_lists,public.profiles;
 end if;
end $$;
