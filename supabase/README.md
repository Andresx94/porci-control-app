# Base de datos de PorciControl (Supabase)

## Migraciones (`migrations/`, aplicar en orden)
1. `20261127000001_esquema.sql`: tablas `granjas`, `miembros`, `madres`, `ciclos`, índices y triggers (Postgres estándar).
2. `20261127000002_seguridad.sql`: seguridad por filas (RLS) por granja y rol (Postgres estándar).
3. `20261127000003_supabase.sql`: lo único propio de Supabase (`auth.uid()`, FK a `auth.users`, permisos).

4. `20261128000001_trabajadores.sql`: trabajadores. Añade `vence_en` y `nombre` a `miembros`, la tabla `invitaciones`, las funciones `rol_en` y `canjear_invitacion`, y los triggers que limitan al `operario` (Postgres estándar). Redefine `es_miembro` y `es_dueno` para que un acceso vencido deje de valer.
5. `20261128000002_trabajadores_supabase.sql`: permisos de Supabase para lo anterior.

En un VPS solo se reemplazan la 3 y la 5.

## Aplicarlas
Pegar las 5 en orden en el SQL Editor del panel de Supabase, o `supabase db push` con la CLI. Si ya aplicaste las 3 primeras, pega solo la 4 y la 5 (en ese orden).

## Registro cerrado
Authentication → Sign In / Providers → desactivar "Allow new users to sign up".
Invitar usuarios desde Authentication → Users → Invite.

## Trabajadores (rol `operario`)
El dueño crea un enlace desde Ajustes → Trabajadores. El trabajador lo abre en su celular y entra como **usuario anónimo** ligado a ese dispositivo (sin correo ni contraseña), con acceso de 30, 45 o 60 días. Para que funcione hay que activar:

Authentication → Sign In / Providers → **Allow anonymous sign-ins**.

Se recomienda dejar el registro normal ("Allow new users to sign up") desactivado: los anónimos no pasan por ahí. Un anónimo sin invitación canjeada no es miembro de ninguna granja y no ve datos.

El trabajador solo puede crear cruces (ciclos nuevos) y llenar campos vacíos de parto, destete y fallo; no crea madres, no edita lo ya escrito, no descarta ni borra. Lo imponen los triggers `madres_restringir_operario` y `ciclos_restringir_operario`, no solo la app.

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
