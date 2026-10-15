-- One business, explicitly appointed owners. No public registration grants admin rights.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
create policy own_membership on public.admin_users for select to authenticated using (user_id = auth.uid());

create function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid())
    and coalesce(auth.jwt()->>'aal','') = 'aal2';
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(name) between 1 and 160),
  email text not null check(length(email) between 3 and 254),
  address text not null default '' check(length(address) <= 1000),
  ico text not null default '' check(length(ico) <= 30),
  vat_id text not null default '' check(length(vat_id) <= 40),
  notes text not null default '' check(length(notes) <= 5000),
  created_at timestamptz not null default now()
);
create unique index clients_email_unique on public.clients(lower(email));
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  description text not null check(length(description) between 1 and 300),
  amount_minor bigint not null check(amount_minor between 1 and 100000000),
  currency text not null default 'CZK' check(currency = 'CZK'),
  status text not null default 'pending' check(status in ('pending','paid','cancelled','refunded')),
  source text not null default 'manual' check(source in ('manual','stripe')),
  provider_id text unique,
  refunded_minor bigint not null default 0 check(refunded_minor between 0 and amount_minor),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.bookings (
  uid text primary key check(length(uid) between 1 and 200),
  name text not null,
  email text not null,
  title text not null,
  starts_at timestamptz not null,
  status text not null check(status in ('accepted','pending','cancelled')),
  updated_at timestamptz not null default now()
);
create table public.business_settings (
  id boolean primary key default true check(id),
  legal_name text not null default '',
  ico text not null default '',
  address text not null default '',
  bank_account text not null default '',
  vat_registered boolean,
  vat_id text not null default '',
  invoice_note text not null default '' check(length(invoice_note)<=1000)
);
insert into public.business_settings(id) values(true);
create table public.invoice_counters(year integer primary key, value integer not null check(value > 0));
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  number text not null unique,
  issue_date date not null,
  due_date date not null,
  supply_date date,
  supplier jsonb not null,
  recipient jsonb not null,
  description text not null,
  amount_minor bigint not null,
  net_minor bigint not null,
  tax_minor bigint not null,
  tax_rate numeric not null check(tax_rate in (0,12,21)),
  currency text not null default 'CZK' check(currency='CZK'),
  created_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 1 and 300),
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.mail_outbox (
  id uuid primary key,
  recipient text not null,
  subject text not null,
  status text not null check(status in ('sending','sent','uncertain')),
  message_id text,
  created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key,
  name text not null check(name in ('page_view','consultation_click','booking_confirmed')),
  session_id uuid not null,
  path text not null check(length(path)<=250),
  service text check(service in ('intro','individual','package')),
  placement text check(placement in ('hero','offer','cta','calendar')),
  language text not null check(language in ('cs','sk','en')),
  created_at timestamptz not null default now()
);
create table public.stripe_invoices (
  id text primary key,
  order_id uuid not null unique references public.orders(id),
  number text,
  status text not null,
  amount_minor bigint not null,
  tax_minor bigint,
  currency text not null check(currency='czk'),
  hosted_url text,
  pdf_url text,
  event_created bigint not null,
  updated_at timestamptz not null default now()
);
create index events_created on public.events(created_at);
create table public.event_rate_limits (bucket text primary key, count integer not null, expires_at timestamptz not null);
create table public.webhook_events (id text primary key, provider text not null, created_at timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['clients','orders','business_settings','tasks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create policy admin_only on public.%I to authenticated using (public.is_admin()) with check (public.is_admin())',t);
  end loop;
  foreach t in array array['bookings','invoices','stripe_invoices','mail_outbox','events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())',t);
  end loop;
  foreach t in array array['invoice_counters','event_rate_limits','webhook_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
  foreach t in array array['admin_users','clients','orders','business_settings','tasks','bookings','invoices','stripe_invoices','mail_outbox','events','invoice_counters','event_rate_limits','webhook_events'] loop
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function public.issue_invoice(p_order uuid, p_tax_rate numeric default 0, p_supply_date date default null)
returns public.invoices language plpgsql security definer set search_path = '' as $$
declare o public.orders; c public.clients; b public.business_settings; inv public.invoices;
  issued date := (now() at time zone 'Europe/Prague')::date; yr integer; seq integer; net bigint;
begin
  if not public.is_admin() then raise exception 'Admin + MFA required' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.status in ('cancelled','refunded') then raise exception 'Order is not billable'; end if;
  if o.source='stripe' then raise exception 'Use the Stripe invoice for this order'; end if;
  select * into inv from public.invoices where order_id=p_order;
  if found then return inv; end if;
  select * into c from public.clients where id=o.client_id;
  select * into b from public.business_settings where id=true;
  if length(trim(b.legal_name))=0 or b.ico !~ '^[0-9]{8}$' or length(trim(b.address))=0
    or length(trim(b.bank_account))=0 or b.vat_registered is null or length(trim(c.address))=0
    or (b.vat_registered and length(trim(b.vat_id))=0) then raise exception 'Complete billing identities and VAT status first'; end if;
  if p_tax_rate is null or p_tax_rate not in (0,12,21) or (not b.vat_registered and p_tax_rate<>0) then raise exception 'Invalid VAT rate'; end if;
  if b.vat_registered and p_supply_date is null then raise exception 'Supply date required for VAT invoice'; end if;
  yr := extract(year from issued);
  insert into public.invoice_counters(year,value) values(yr,1)
    on conflict(year) do update set value=public.invoice_counters.value+1 returning value into seq;
  net := round(o.amount_minor/(1+p_tax_rate/100.0));
  insert into public.invoices(order_id,number,issue_date,due_date,supply_date,supplier,recipient,description,amount_minor,net_minor,tax_minor,tax_rate)
    values(o.id,yr::text||lpad(seq::text,greatest(5,length(seq::text)),'0'),issued,issued+14,p_supply_date,to_jsonb(b),to_jsonb(c),o.description,o.amount_minor,net,o.amount_minor-net,p_tax_rate)
    returning * into inv;
  return inv;
end $$;
revoke all on function public.issue_invoice(uuid,numeric,date) from public;
grant execute on function public.issue_invoice(uuid,numeric,date) to authenticated;

create function public.analytics_summary() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'events',coalesce((select jsonb_agg(x) from (
      select name,count(*) as count,count(distinct session_id) as sessions from public.events
      where created_at>=now()-interval '30 days' group by name
    ) x),'[]'::jsonb),
    'days',coalesce((select jsonb_agg(x) from (
      select (created_at at time zone 'Europe/Prague')::date as day,count(*) filter(where name='page_view') as views,
        count(*) filter(where name='consultation_click') as clicks from public.events
      where created_at>=now()-interval '30 days' group by day order by day
    ) x),'[]'::jsonb)
  );
$$;
revoke all on function public.analytics_summary() from public;
grant execute on function public.analytics_summary() to authenticated;

-- Atomic ingestion limit. The bucket is an HMAC of the source address and minute.
create function public.accept_event(p_bucket text,p_event jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  insert into public.event_rate_limits(bucket,count,expires_at) values(p_bucket,1,now()+interval '2 minutes')
    on conflict(bucket) do update set count=public.event_rate_limits.count+1 returning count into n;
  if n>60 then return false; end if;
  insert into public.events(id,name,session_id,path,service,placement,language)
    values((p_event->>'id')::uuid,p_event->>'name',(p_event->>'session_id')::uuid,p_event->>'path',p_event->>'service',p_event->>'placement',p_event->>'language')
    on conflict(id) do nothing;
  delete from public.event_rate_limits where expires_at<now();
  return true;
end $$;
revoke all on function public.accept_event(text,jsonb) from public;
grant execute on function public.accept_event(text,jsonb) to service_role;

-- Signed payment updates are atomic and idempotent; browser callbacks never mark an order paid.
create function public.apply_payment(p_event text,p_order uuid,p_amount bigint,p_currency text,p_provider text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.amount_minor<>p_amount or lower(p_currency)<>'czk' or o.status='cancelled' then raise exception 'Payment mismatch'; end if;
  insert into public.webhook_events(id,provider) values(p_event,'stripe') on conflict(id) do nothing;
  if not found then return false; end if;
  update public.orders set status='paid',source='stripe',provider_id=p_provider,paid_at=now() where id=p_order and status='pending';
  return true;
end $$;
revoke all on function public.apply_payment(text,uuid,bigint,text,text) from public;
grant execute on function public.apply_payment(text,uuid,bigint,text,text) to service_role;

create function public.apply_booking(p_uid text,p_name text,p_email text,p_title text,p_starts timestamptz,p_status text,p_event_time timestamptz)
returns void language sql security definer set search_path='' as $$
  insert into public.bookings(uid,name,email,title,starts_at,status,updated_at)
  values(p_uid,p_name,p_email,p_title,p_starts,p_status,p_event_time)
  on conflict(uid) do update set name=excluded.name,email=excluded.email,title=excluded.title,
    starts_at=excluded.starts_at,status=excluded.status,updated_at=excluded.updated_at
    where excluded.updated_at>=public.bookings.updated_at;
$$;
revoke all on function public.apply_booking(text,text,text,text,timestamptz,text,timestamptz) from public;
grant execute on function public.apply_booking(text,text,text,text,timestamptz,text,timestamptz) to service_role;

create function public.business_summary() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'revenue',coalesce((select sum(amount_minor-refunded_minor) from public.orders where status='paid'),0),
    'month_revenue',coalesce((select sum(amount_minor-refunded_minor) from public.orders where status='paid' and paid_at>=date_trunc('month',now() at time zone 'Europe/Prague') at time zone 'Europe/Prague'),0),
    'pending',(select count(*) from public.orders where status='pending'),
    'clients',(select count(*) from public.clients),
    'bookings',(select count(*) from public.bookings where status='accepted' and starts_at>now())
  );
$$;
revoke all on function public.business_summary() from public;
grant execute on function public.business_summary() to authenticated;

create function public.begin_checkout(p_order uuid) returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'Admin + MFA required' using errcode='42501'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.status<>'pending' then raise exception 'Order is not payable'; end if;
  if exists(select 1 from public.invoices where order_id=p_order) then raise exception 'A local invoice already exists'; end if;
  update public.orders set source='stripe' where id=p_order returning * into o;
  return o;
end $$;
revoke all on function public.begin_checkout(uuid) from public;
grant execute on function public.begin_checkout(uuid) to authenticated;

create function public.apply_refund(p_event text,p_order uuid,p_refunded bigint) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.source<>'stripe' or p_refunded<0 or p_refunded>o.amount_minor then raise exception 'Refund mismatch'; end if;
  insert into public.webhook_events(id,provider) values(p_event,'stripe') on conflict(id) do nothing;
  if not found then return; end if;
  update public.orders set refunded_minor=greatest(refunded_minor,p_refunded),
    status=case when p_refunded=amount_minor then 'refunded' else status end where id=p_order;
end $$;
revoke all on function public.apply_refund(text,uuid,bigint) from public;
grant execute on function public.apply_refund(text,uuid,bigint) to service_role;

create function public.apply_stripe_invoice(p_invoice jsonb,p_created bigint) returns void
language sql security definer set search_path='' as $$
  insert into public.stripe_invoices(id,order_id,number,status,amount_minor,tax_minor,currency,hosted_url,pdf_url,event_created)
  values(p_invoice->>'id',(p_invoice->>'order_id')::uuid,p_invoice->>'number',p_invoice->>'status',
    (p_invoice->>'amount_minor')::bigint,(p_invoice->>'tax_minor')::bigint,p_invoice->>'currency',p_invoice->>'hosted_url',p_invoice->>'pdf_url',p_created)
  on conflict(id) do update set number=excluded.number,status=excluded.status,amount_minor=excluded.amount_minor,
    tax_minor=excluded.tax_minor,hosted_url=excluded.hosted_url,pdf_url=excluded.pdf_url,event_created=excluded.event_created,updated_at=now()
    where excluded.event_created>=public.stripe_invoices.event_created;
$$;
revoke all on function public.apply_stripe_invoice(jsonb,bigint) from public;
grant execute on function public.apply_stripe_invoice(jsonb,bigint) to service_role;

create table public.admin_backend_versions(version text primary key);
alter table public.admin_backend_versions enable row level security;
revoke all on public.admin_backend_versions from public,anon,authenticated;
insert into public.admin_backend_versions values('202610150001');
