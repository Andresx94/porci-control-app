-- PorciControl: refuerzo (solo Supabase). Sin sesión no hay ningún permiso sobre las tablas,
-- aunque las políticas RLS ya lo bloquearían.
revoke all on granjas, miembros, madres, ciclos, invitaciones from anon;
