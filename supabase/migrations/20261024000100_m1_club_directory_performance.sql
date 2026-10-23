-- Supports the API directory query: WHERE is_active = true ORDER BY name.
create index if not exists clubs_active_name_idx
  on public.clubs (is_active, name);
