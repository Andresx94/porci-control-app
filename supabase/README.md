# Base de datos de PorciControl (Supabase)

## Migraciones (`migrations/`, aplicar en orden)
1. `20261127000001_esquema.sql`: tablas `granjas`, `miembros`, `madres`, `ciclos`, índices y triggers (Postgres estándar).
2. `20261127000002_seguridad.sql`: seguridad por filas (RLS) por granja y rol (Postgres estándar).
3. `20261127000003_supabase.sql`: lo único propio de Supabase (`auth.uid()`, FK a `auth.users`, permisos).

En un VPS solo se reemplaza la 3.

## Aplicarlas
Pegar las 3 en orden en el SQL Editor del panel de Supabase, o `supabase db push` con la CLI.

## Registro cerrado
Authentication → Sign In / Providers → desactivar "Allow new users to sign up".
Invitar usuarios desde Authentication → Users → Invite.

## Crear la granja y el primer dueño
Ejecutar en el SQL Editor (rol admin, sin restricciones):

```sql
with g as (
  insert into granjas (nombre, zona_horaria)
  values ('Mi granja', 'America/Guayaquil')
  returning id
)
insert into miembros (granja_id, usuario_id, rol)
select id, '<UUID_DEL_USUARIO>', 'dueno' from g;
```

El UUID está en Authentication → Users. Para más usuarios, el mismo `insert` en `miembros` con rol `dueno` u `operario`.

## Recordatorios
- La clave `service_role`/secret nunca va en el código ni en el repo (es público). La app solo usa la URL y la clave pública (anon/publishable).
- Las alertas y preferencias no van a la base.
- Borrar = poner `borrado_en` (nadie puede hacer DELETE); solo el dueño borra o restaura.
