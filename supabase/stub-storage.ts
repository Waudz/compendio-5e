// Apoio aos testes PGlite: o PGlite não tem o esquema `storage` do Supabase; este stub reproduz o necessário para a migração 0006
// (buckets, objects com RLS, foldername). Só para testes; nunca é executado no Supabase.
export const storageStub = `
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner_id text default auth.uid()::text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
`;
