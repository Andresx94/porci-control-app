-- PorciControl: lo único propio de Supabase.
-- En un VPS este archivo se reemplaza por el equivalente de tu autenticación.

-- El usuario sale del token de Supabase Auth.
create or replace function usuario_actual() returns uuid
language sql stable
as $$ select auth.uid() $$;

-- Ahora sí: los miembros apuntan a usuarios reales.
alter table miembros
  add constraint miembros_usuario_fk
  foreign key (usuario_id) references auth.users(id) on delete cascade;

-- Sin acceso anónimo.
revoke all on granjas, miembros, madres, ciclos from anon;

-- authenticated: permisos mínimos y explícitos (nunca delete/truncate).
revoke all on granjas, miembros, madres, ciclos from authenticated;
grant select, update         on granjas  to authenticated;
grant select, insert, update on miembros to authenticated;
grant select, insert, update on madres   to authenticated;
grant select, insert, update on ciclos   to authenticated;

-- Funciones auxiliares: fuera para anon, dentro para authenticated
-- (las políticas RLS las necesitan).
revoke execute on function usuario_actual(), es_miembro(uuid), es_dueno(uuid) from public, anon;
grant  execute on function usuario_actual(), es_miembro(uuid), es_dueno(uuid) to authenticated, service_role;
