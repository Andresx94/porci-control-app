-- PorciControl: trabajadores (rol 'operario') con acceso que vence, invitados por enlace.
-- Postgres estándar: usa usuario_actual(), sin nada de Supabase.

-- ---------------------------------------------------------------- miembros
-- vence_en null = no vence. nombre = etiqueta que pone el dueño.
alter table miembros
  add column vence_en timestamptz,
  add column nombre text;

-- Un miembro con acceso vencido deja de serlo (RLS y triggers usan estas funciones).
create or replace function es_miembro(p_granja uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from miembros m join granjas g on g.id = m.granja_id
    where m.granja_id = p_granja
      and m.usuario_id = usuario_actual()
      and m.borrado_en is null
      and (m.vence_en is null or m.vence_en > now())
      and g.borrado_en is null
  )
$$;

create or replace function es_dueno(p_granja uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from miembros m join granjas g on g.id = m.granja_id
    where m.granja_id = p_granja
      and m.usuario_id = usuario_actual()
      and m.rol = 'dueno'
      and m.borrado_en is null
      and (m.vence_en is null or m.vence_en > now())
      and g.borrado_en is null
  )
$$;

-- Rol vigente del usuario en la granja, o null.
create function rol_en(p_granja uuid) returns text
language sql stable security definer set search_path = public
as $$
  select m.rol
  from miembros m join granjas g on g.id = m.granja_id
  where m.granja_id = p_granja
    and m.usuario_id = usuario_actual()
    and m.borrado_en is null
    and (m.vence_en is null or m.vence_en > now())
    and g.borrado_en is null
$$;

-- El trabajador solo ve su propia fila de miembro; el dueño ve a todos los de su granja.
drop policy miembros_select on miembros;
create policy miembros_select on miembros for select
  using (es_dueno(granja_id) or (usuario_id = usuario_actual() and es_miembro(granja_id)));

-- ---------------------------------------------------------------- invitaciones
-- El token nunca se guarda: solo su sha256 en hexadecimal.
create table invitaciones (
  id          uuid primary key default gen_random_uuid(),
  granja_id   uuid not null references granjas(id),
  token_hash  text not null unique,
  nombre      text,
  dias        int not null check (dias in (30, 45, 60)),
  creado_por  uuid,
  creado_en   timestamptz not null default now(),
  vence_en    timestamptz not null default now() + interval '7 days',  -- validez del enlace
  usado_en    timestamptz,
  usado_por   uuid,
  borrado_en  timestamptz
);
create index invitaciones_granja_idx on invitaciones (granja_id);

alter table invitaciones enable row level security;

-- Solo el dueño ve, crea y anula; sin DELETE.
create policy invitaciones_select on invitaciones for select using (es_dueno(granja_id));
create policy invitaciones_insert on invitaciones for insert
  with check (es_dueno(granja_id) and usado_en is null);
create policy invitaciones_update on invitaciones for update
  using (es_dueno(granja_id)) with check (es_dueno(granja_id));

-- Canjea un token: el usuario actual pasa a ser 'operario' de la granja, con acceso
-- que vence en `dias`. Devuelve el id de la granja.
create function canjear_invitacion(p_token text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_usuario uuid := usuario_actual();
  v_inv     invitaciones%rowtype;
begin
  if v_usuario is null then
    raise exception 'Hay que iniciar sesión para canjear la invitación';
  end if;

  select * into v_inv
  from invitaciones
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and usado_en is null
    and borrado_en is null
    and vence_en > now()
  for update;

  if not found then
    raise exception 'Invitación no válida o vencida';
  end if;

  -- Un dueño vigente no se degrada.
  if exists (
    select 1 from miembros m
    where m.granja_id = v_inv.granja_id
      and m.usuario_id = v_usuario
      and m.rol = 'dueno'
      and m.borrado_en is null
      and (m.vence_en is null or m.vence_en > now())
  ) then
    raise exception 'Este usuario ya es dueño de la granja';
  end if;

  insert into miembros (granja_id, usuario_id, rol, vence_en, nombre)
  values (v_inv.granja_id, v_usuario, 'operario', now() + v_inv.dias * interval '1 day', v_inv.nombre)
  on conflict (granja_id, usuario_id) do update
    set rol        = 'operario',
        vence_en   = excluded.vence_en,
        nombre     = excluded.nombre,
        borrado_en = null;

  update invitaciones
  set usado_en = now(), usado_por = v_usuario
  where id = v_inv.id;

  return v_inv.granja_id;
end $$;

-- ---------------------------------------------------------------- restricciones del operario
-- Aplican a quien no es dueño (sin usuario, o sea admin/servidor, no se restringe).
--
-- IMPORTANTE: un upsert (INSERT ... ON CONFLICT DO UPDATE) dispara primero los triggers de
-- INSERT con la fila propuesta aunque luego termine en UPDATE, y la app sube todo con upsert.
-- Por eso, si el id ya existe, el INSERT se deja pasar y decide el trigger de UPDATE
-- (que sí ve old/new reales).
create function restringir_operario() returns trigger
language plpgsql as $$
declare
  v_old    jsonb;
  v_new    jsonb;
  v_clave  text;
  v_libres constant text[] := array['estado_ciclo', 'actualizado_en', 'actualizado_por', 'creado_en'];
begin
  if usuario_actual() is null or es_dueno(new.granja_id) then
    return new;
  end if;

  if tg_table_name = 'madres' then
    if tg_op = 'INSERT' then
      if exists (select 1 from madres where id = new.id) then
        return new;  -- upsert sobre una madre existente: decide el trigger de UPDATE
      end if;
      raise exception 'Solo el dueño puede registrar madres';
    end if;

    -- UPDATE: solo cambia `estado` (y lo que pone el servidor), nunca a/desde 'descartada'.
    v_old := to_jsonb(old) - array['estado', 'actualizado_en', 'actualizado_por', 'creado_en'];
    v_new := to_jsonb(new) - array['estado', 'actualizado_en', 'actualizado_por', 'creado_en'];
    if v_old is distinct from v_new then
      raise exception 'El trabajador solo puede cambiar el estado de la madre';
    end if;
    if new.estado is distinct from old.estado
       and (new.estado = 'descartada' or old.estado = 'descartada') then
      raise exception 'El trabajador no puede descartar ni reactivar madres';
    end if;
    return new;

  elsif tg_table_name = 'ciclos' then
    if tg_op = 'INSERT' then
      if exists (select 1 from ciclos where id = new.id) then
        return new;  -- upsert sobre un ciclo existente: decide el trigger de UPDATE
      end if;
      if new.borrado_en is not null then
        raise exception 'Solo el dueño puede borrar o restaurar';
      end if;
      return new;
    end if;

    -- UPDATE: cada dato que cambia debe estar vacío (null) antes.
    if new.borrado_en is distinct from old.borrado_en then
      raise exception 'Solo el dueño puede borrar o restaurar';
    end if;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for v_clave in select jsonb_object_keys(v_new) loop
      continue when v_clave = any (v_libres);
      if (v_old -> v_clave) is distinct from (v_new -> v_clave)
         and (v_old -> v_clave) <> 'null'::jsonb then
        raise exception 'El trabajador solo puede llenar datos vacíos';
      end if;
    end loop;
    return new;
  end if;

  return new;
end $$;

create trigger madres_restringir_operario before insert or update on madres
  for each row execute function restringir_operario();
create trigger ciclos_restringir_operario before insert or update on ciclos
  for each row execute function restringir_operario();

-- solo_dueno_borra (archivo 2 de seguridad) queda igual: el operario nunca borra ni restaura.
