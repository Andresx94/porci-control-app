-- PorciControl: permisos de Supabase para la parte de trabajadores.
-- En un VPS este archivo se reemplaza por el equivalente.

-- invitaciones: solo usuarios con sesión (los trabajadores son anónimos pero 'authenticated').
revoke all on invitaciones from anon;
revoke all on invitaciones from authenticated;
grant select, insert, update on invitaciones to authenticated;

-- Funciones: fuera para anon, dentro para authenticated.
revoke execute on function canjear_invitacion(text), rol_en(uuid) from public, anon;
grant  execute on function canjear_invitacion(text), rol_en(uuid) to authenticated, service_role;

-- create or replace conserva los permisos; se repiten por si acaso (es idempotente).
revoke execute on function es_miembro(uuid), es_dueno(uuid) from public, anon;
grant  execute on function es_miembro(uuid), es_dueno(uuid) to authenticated, service_role;

-- Función de trigger: no se llama directamente.
revoke execute on function restringir_operario() from public, anon, authenticated;
