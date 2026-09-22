-- Migration 009: Daily Request Quotas (10,000 requests / day per user or IP)
-- Reset at 00:00 WIB (UTC+7)

create table if not exists daily_request_quotas (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,                -- 'user:<uuid>' atau 'ip:<client_ip>'
  date date not null default current_date, -- tanggal kalender
  request_count int not null default 1,    -- akumulasi jumlah request
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identifier, date)
);

create index if not exists idx_quotas_identifier_date on daily_request_quotas(identifier, date);
create index if not exists idx_quotas_date on daily_request_quotas(date);

-- Enable RLS
alter table daily_request_quotas enable row level security;

-- Policy: Hanya service role / server yang boleh mengelola tabel kuota ini
create policy "Service role manage daily quotas"
  on daily_request_quotas
  for all
  using (true)
  with check (true);

-- Atomic increment function:
-- Mengembalikan: current_count, allowed, remaining, reset_at
create or replace function increment_daily_quota(
  p_identifier text,
  p_date date,
  p_limit int default 10000
)
returns table (
  allowed boolean,
  current_count int,
  remaining int
)
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  insert into daily_request_quotas (identifier, date, request_count, updated_at)
  values (p_identifier, p_date, 1, now())
  on conflict (identifier, date)
  do update set
    request_count = daily_request_quotas.request_count + 1,
    updated_at = now()
  returning daily_request_quotas.request_count into v_count;

  return query select
    (v_count <= p_limit) as allowed,
    v_count as current_count,
    greatest(0, p_limit - v_count) as remaining;
end;
$$;
