-- ============================================================
-- Watt EV Charging App — Full Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────
create type membership_level as enum ('standard', 'silver', 'gold');
create type station_status    as enum ('available', 'busy', 'fault', 'offline');
create type connector_type    as enum ('Type2', 'CCS', 'CHAdeMO', 'GBT', 'Tesla');
create type connector_status  as enum ('available', 'occupied', 'fault', 'offline');
create type booking_status    as enum ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show');
create type session_status    as enum ('active', 'completed', 'interrupted');
create type tx_type           as enum ('topup', 'charge', 'refund', 'bonus');
create type location_type     as enum ('mall', 'hotel', 'hospital', 'university', 'residential', 'commercial', 'fuel_station', 'other');
create type energy_source     as enum ('grid', 'solar', 'hybrid');
create type watt_box_option   as enum ('buy', 'subscribe', 'none');
create type app_status        as enum ('pending', 'reviewing', 'approved', 'rejected');

-- ─── PROFILES ────────────────────────────────────────────────
create table profiles (
  id                uuid        primary key references auth.users on delete cascade,
  phone             text        not null default '',
  full_name         text        not null default '',
  avatar_url        text,
  membership_level  membership_level not null default 'standard',
  wallet_balance    numeric(10,3) not null default 0,
  total_sessions    int         not null default 0,
  total_kwh         numeric(10,3) not null default 0,
  rating            numeric(3,2) not null default 5.0,
  car_model         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, coalesce(new.phone, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ─── STATIONS ────────────────────────────────────────────────
create table stations (
  id                  uuid          primary key default gen_random_uuid(),
  name                text          not null,
  name_ar             text,
  address             text          not null default '',
  address_ar          text,
  governorate         text          not null,
  wilayat             text,
  latitude            numeric(10,6) not null,
  longitude           numeric(10,6) not null,
  status              station_status not null default 'available',
  price_per_kwh       numeric(6,3)  not null default 0.028,
  total_connectors    int           not null default 1,
  available_connectors int          not null default 1,
  rating              numeric(3,2)  not null default 5.0,
  total_ratings       int           not null default 0,
  power_kw            numeric(6,1)  not null default 22,
  image_url           text,
  amenities           text[],
  operating_hours     text          not null default '24/7',
  last_maintenance    timestamptz,
  created_at          timestamptz   not null default now()
);

-- ─── CONNECTORS ──────────────────────────────────────────────
create table connectors (
  id             uuid             primary key default gen_random_uuid(),
  station_id     uuid             not null references stations on delete cascade,
  connector_type connector_type   not null,
  power_kw       numeric(6,1)     not null,
  status         connector_status not null default 'available'
);

-- ─── BOOKINGS ────────────────────────────────────────────────
create table bookings (
  id                  uuid           primary key default gen_random_uuid(),
  user_id             uuid           not null references auth.users on delete cascade,
  station_id          uuid           not null references stations on delete cascade,
  connector_id        uuid           references connectors on delete set null,
  status              booking_status not null default 'pending',
  booked_at           timestamptz    not null,
  duration_minutes    int            not null,
  estimated_kwh       numeric(8,3),
  estimated_cost      numeric(8,3),
  actual_kwh          numeric(8,3),
  actual_cost         numeric(8,3),
  qr_code             text           not null default gen_random_uuid()::text,
  cancellation_reason text,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now()
);

create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ─── CHARGING SESSIONS ───────────────────────────────────────
create table charging_sessions (
  id                uuid           primary key default gen_random_uuid(),
  booking_id        uuid           references bookings on delete set null,
  user_id           uuid           not null references auth.users on delete cascade,
  station_id        uuid           not null references stations on delete cascade,
  connector_id      uuid           references connectors on delete set null,
  status            session_status not null default 'active',
  started_at        timestamptz    not null default now(),
  ended_at          timestamptz,
  kwh_delivered     numeric(8,3)   not null default 0,
  cost              numeric(8,3)   not null default 0,
  battery_start_pct int,
  battery_end_pct   int,
  created_at        timestamptz    not null default now()
);

-- ─── WALLET TRANSACTIONS ─────────────────────────────────────
create table wallet_transactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  type           tx_type     not null,
  amount         numeric(8,3) not null,
  balance_after  numeric(10,3) not null,
  description    text        not null default '',
  reference_id   text,
  payment_method text,
  created_at     timestamptz not null default now()
);

-- ─── INVESTOR APPLICATIONS ───────────────────────────────────
create table investor_applications (
  id                 uuid           primary key default gen_random_uuid(),
  user_id            uuid           references auth.users on delete set null,
  full_name          text           not null,
  phone              text           not null,
  email              text,
  location_name      text           not null,
  location_type      location_type  not null,
  governorate        text           not null,
  wilayat            text,
  charger_count      int            not null default 1,
  charger_types      text[],
  energy_source      energy_source,
  availability_hours text,
  suggested_price    numeric(6,3),
  description        text,
  package_type       text           not null default 'basic',
  watt_box_option    watt_box_option,
  status             app_status     not null default 'pending',
  created_at         timestamptz    not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────
create index on stations (status);
create index on stations (governorate);
create index on connectors (station_id);
create index on bookings (user_id);
create index on bookings (station_id);
create index on bookings (status);
create index on bookings (booked_at);
create index on charging_sessions (user_id);
create index on charging_sessions (station_id);
create index on wallet_transactions (user_id);
create index on wallet_transactions (created_at desc);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table profiles             enable row level security;
alter table stations             enable row level security;
alter table connectors           enable row level security;
alter table bookings             enable row level security;
alter table charging_sessions    enable row level security;
alter table wallet_transactions  enable row level security;
alter table investor_applications enable row level security;

-- profiles: own row only
create policy "profiles: read own"   on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);

-- stations: public read
create policy "stations: public read" on stations for select using (true);

-- connectors: public read
create policy "connectors: public read" on connectors for select using (true);

-- bookings: own rows only
create policy "bookings: read own"   on bookings for select using (auth.uid() = user_id);
create policy "bookings: insert own" on bookings for insert with check (auth.uid() = user_id);
create policy "bookings: update own" on bookings for update using (auth.uid() = user_id);

-- charging_sessions: own rows only
create policy "sessions: read own"   on charging_sessions for select using (auth.uid() = user_id);
create policy "sessions: insert own" on charging_sessions for insert with check (auth.uid() = user_id);
create policy "sessions: update own" on charging_sessions for update using (auth.uid() = user_id);

-- wallet_transactions: own rows only
create policy "wallet: read own"   on wallet_transactions for select using (auth.uid() = user_id);
create policy "wallet: insert own" on wallet_transactions for insert with check (auth.uid() = user_id);

-- investor_applications: anyone authenticated can submit
create policy "investor: insert auth" on investor_applications for insert with check (auth.uid() is not null);
create policy "investor: read own"    on investor_applications for select using (auth.uid() = user_id);

-- ─── REALTIME ────────────────────────────────────────────────
-- Enable realtime for tables the app subscribes to
alter publication supabase_realtime add table stations;
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table charging_sessions;

-- ─── SEED: 15 OMANI STATIONS ─────────────────────────────────
insert into stations (name, name_ar, address, address_ar, governorate, wilayat, latitude, longitude, status, price_per_kwh, total_connectors, available_connectors, rating, total_ratings, power_kw, amenities, operating_hours) values
('Muscat Mall Charging Hub',    'محطة شحن مسقط مول',        'Muscat Mall, Al Khuwair',          'مسقط مول، الخوير',              'مسقط',                'بوشر',        23.5880, 58.3829, 'available', 0.028, 4, 4, 4.8, 124, 50,  array['mall','wifi','parking','food_court','restrooms'],    '06:00-00:00'),
('Avenues Mall Station',        'محطة أفنيوز مول',           'The Avenues Mall, Muscat',         'أفنيوز مول، مسقط',              'مسقط',                'السيب',       23.6000, 58.1500, 'available', 0.028, 6, 5, 4.9, 89,  150, array['mall','wifi','parking','food_court','restrooms'],    '09:00-23:00'),
('Seeb International Airport',  'مطار مسقط الدولي',          'Muscat International Airport',     'مطار مسقط الدولي',              'مسقط',                'السيب',       23.5928, 58.2843, 'available', 0.030, 8, 6, 4.7, 212, 150, array['airport','wifi','parking','restrooms','24h_service'],'24/7'),
('Royal Hospital Charging',     'محطة المستشفى السلطاني',    'Royal Hospital, Al Ghubra',        'المستشفى السلطاني، الغبرة',     'مسقط',                'بوشر',        23.6030, 58.4025, 'busy',      0.025, 2, 0, 4.5, 67,  22,  array['hospital','parking','restrooms'],                    '24/7'),
('Shatti Al Qurum Waterfront',  'شاطئ القرم',                'Shatti Al Qurum Beach',            'شاطئ القرم، مسقط',              'مسقط',                'القرم',       23.5975, 58.4102, 'available', 0.028, 3, 3, 4.6, 95,  50,  array['outdoor','seaside','parking','restrooms'],           '05:00-23:00'),
('Bahja Petrol Station',        'محطة بهجة للوقود',          'Bahja Service Station, Muscat',    'محطة بهجة، مسقط',               'مسقط',                'القرم',       23.5750, 58.3900, 'available', 0.026, 2, 2, 4.3, 41,  22,  array['parking','restrooms','convenience_store'],           '24/7'),
('Nizwa Fort Plaza',            'ساحة قلعة نزوى',            'Nizwa Fort, Nizwa',                'قلعة نزوى، نزوى',               'الداخلية',            'نزوى',        22.9333, 57.5333, 'available', 0.025, 3, 3, 4.7, 78,  50,  array['tourist_site','parking','outdoor'],                  '08:00-20:00'),
('Sohar Port Industrial Zone',  'منطقة ميناء صحار الصناعية', 'Sohar Port, Sohar',                'ميناء صحار، صحار',              'الباطنة الشمالية',    'صحار',        24.3500, 56.7500, 'available', 0.024, 4, 4, 4.4, 53,  150, array['parking','restrooms'],                               '24/7'),
('Salalah Garden Mall',         'محطة صلالة غاردن مول',      'Salalah Garden Mall',              'صلالة غاردن مول، صلالة',        'ظفار',                'صلالة',       17.0235, 54.0924, 'available', 0.028, 4, 3, 4.8, 102, 50,  array['mall','wifi','parking','food_court','restrooms'],    '09:00-23:00'),
('Salalah Beach Resort',        'منتجع شاطئ صلالة',          'Salalah Beach Resort, Dhofar',     'منتجع شاطئ صلالة، ظفار',        'ظفار',                'صلالة',       17.0150, 54.1200, 'available', 0.030, 2, 2, 4.9, 44,  22,  array['hotel','wifi','parking','outdoor','seaside'],        '24/7'),
('Sur Marina',                  'مرسى صور',                  'Sur Marina, Sur',                  'مرسى صور، صور',                 'الشرقية الجنوبية',    'صور',         22.5689, 59.5285, 'available', 0.026, 2, 2, 4.5, 29,  22,  array['marina','outdoor','parking'],                        '06:00-22:00'),
('Ibri Commercial Centre',      'المركز التجاري العبري',     'Ibri Commercial Centre, Ibri',     'المركز التجاري، العبري',        'الظاهرة',             'عبري',        23.2167, 56.5167, 'available', 0.024, 2, 2, 4.2, 18,  22,  array['parking','restrooms'],                               '08:00-22:00'),
('Musandam Khasab Port',        'ميناء خصب، مسندم',          'Khasab Port, Musandam',            'ميناء خصب، مسندم',              'مسندم',               'خصب',         26.1833, 56.2333, 'available', 0.029, 2, 2, 4.6, 22,  22,  array['outdoor','scenic_view','parking'],                   '07:00-21:00'),
('Buraimi Al Mahatta',          'محطة البريمي',               'Al Mahatta Area, Buraimi',         'منطقة المحطة، البريمي',         'البريمي',             'البريمي',     24.2500, 55.7833, 'available', 0.025, 2, 1, 4.1, 15,  22,  array['parking','restrooms'],                               '24/7'),
('Duqm Special Economic Zone',  'منطقة الدقم الاقتصادية',   'Duqm SEZ, Al Wusta',               'منطقة الدقم الاقتصادية الخاصة','الوسطى',              'الدقم',       19.6667, 57.7000, 'available', 0.023, 4, 4, 4.5, 31,  150, array['parking','restrooms','24h_service'],                 '24/7');

-- Add connectors for each station (sample — adjust as needed)
insert into connectors (station_id, connector_type, power_kw, status)
select id, 'CCS'::connector_type,      150, 'available'::connector_status from stations where name = 'Muscat Mall Charging Hub'
union all
select id, 'Type2'::connector_type,     50, 'available'::connector_status from stations where name = 'Muscat Mall Charging Hub'
union all
select id, 'CCS'::connector_type,      150, 'available'::connector_status from stations where name = 'Avenues Mall Station'
union all
select id, 'Type2'::connector_type,     50, 'available'::connector_status from stations where name = 'Avenues Mall Station'
union all
select id, 'CHAdeMO'::connector_type,  150, 'available'::connector_status from stations where name = 'Seeb International Airport'
union all
select id, 'CCS'::connector_type,      150, 'available'::connector_status from stations where name = 'Seeb International Airport'
union all
select id, 'Type2'::connector_type,     22, 'occupied'::connector_status  from stations where name = 'Royal Hospital Charging'
union all
select id, 'Type2'::connector_type,     22, 'occupied'::connector_status  from stations where name = 'Royal Hospital Charging'
union all
select id, 'CCS'::connector_type,       50, 'available'::connector_status from stations where name = 'Shatti Al Qurum Waterfront'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Bahja Petrol Station'
union all
select id, 'CCS'::connector_type,       50, 'available'::connector_status from stations where name = 'Nizwa Fort Plaza'
union all
select id, 'CCS'::connector_type,      150, 'available'::connector_status from stations where name = 'Sohar Port Industrial Zone'
union all
select id, 'CCS'::connector_type,       50, 'available'::connector_status from stations where name = 'Salalah Garden Mall'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Salalah Beach Resort'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Sur Marina'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Ibri Commercial Centre'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Musandam Khasab Port'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Buraimi Al Mahatta'
union all
select id, 'CCS'::connector_type,      150, 'available'::connector_status from stations where name = 'Duqm Special Economic Zone'
union all
select id, 'Type2'::connector_type,     22, 'available'::connector_status from stations where name = 'Duqm Special Economic Zone';
