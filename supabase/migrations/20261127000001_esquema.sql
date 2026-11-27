-- PorciControl: esquema multi-granja (Postgres estándar, sin nada de Supabase).

-- Usuario de la sesión. En Supabase se reemplaza (archivo 3) por auth.uid().
-- Aquí se lee de una variable de sesión: set app.usuario_id = '<uuid>'.
create function usuario_actual() returns uuid
language sql stable
as $$ select nullif(current_setting('app.usuario_id', true), '')::uuid $$;

-- ---------------------------------------------------------------- granjas
create table granjas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) > 0),
  zona_horaria   text not null,           -- ej. 'America/Guayaquil'
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  borrado_en     timestamptz
);

-- Valida que la zona horaria exista (pg_timezone_names).
create function validar_zona_horaria() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.zona_horaria) then
    raise exception 'Zona horaria no válida: %', new.zona_horaria;
  end if;
  return new;
end $$;

create trigger granjas_validar_zona
  before insert or update on granjas
  for each row execute function validar_zona_horaria();

-- ---------------------------------------------------------------- miembros
-- usuario_id sin FK aquí: en Supabase se añade en el archivo 3 (auth.users).
create table miembros (
  granja_id      uuid not null references granjas(id),
  usuario_id     uuid not null,
  rol            text not null check (rol in ('dueno', 'operario')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  borrado_en     timestamptz,
  primary key (granja_id, usuario_id)
);
create index miembros_usuario_idx on miembros (usuario_id);

-- ---------------------------------------------------------------- madres
-- El id lo crea el teléfono; el default es solo por comodidad.
create table madres (
  id               uuid primary key default gen_random_uuid(),
  granja_id        uuid not null references granjas(id),
  arete            text not null check (length(trim(arete)) > 0),
  fecha_nacimiento date,
  estado           text not null
                   check (estado in ('activa','gestacion','lactancia','vacia','descartada')),
  observaciones    text,
  fecha_registro   date not null,
  registrado_en    timestamptz,
  fecha_descarte   date,
  descartado_en    timestamptz,
  motivo_descarte  text,
  arete_madre      text,
  arete_padre      text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  borrado_en       timestamptz,
  actualizado_por  uuid,
  unique (id, granja_id)                  -- para la FK compuesta de ciclos
);
-- Un arete vivo no se repite dentro de la granja.
create unique index madres_arete_uq on madres (granja_id, arete) where borrado_en is null;
create index madres_sync_idx on madres (granja_id, actualizado_en);

-- ---------------------------------------------------------------- ciclos
create table ciclos (
  id                uuid primary key default gen_random_uuid(),
  granja_id         uuid not null,
  madre_id          uuid not null,
  -- FK compuesta: la madre debe ser de la misma granja.
  foreign key (madre_id, granja_id) references madres (id, granja_id),
  numero_ciclo      int not null check (numero_ciclo >= 1),
  intento           int not null default 1 check (intento >= 1),
  fecha_cruce       date not null,
  tipo_cruce        text not null check (tipo_cruce in ('monta_natural','inseminacion')),
  numero_verraco    text,
  observaciones_cruce    text,
  fecha_parto_prevista   date,
  fecha_vacuna_suicen    date,
  fecha_enjaule          date,
  fecha_destete_prevista date,
  fecha_siguiente_monta  date,
  -- parto
  fecha_parto_real  date,
  nacidos_totales   int check (nacidos_totales   is null or nacidos_totales   >= 0),
  nacidos_vivos     int check (nacidos_vivos     is null or nacidos_vivos     >= 0),
  nacidos_muertos   int check (nacidos_muertos   is null or nacidos_muertos   >= 0),
  momias            int check (momias            is null or momias            >= 0),
  observaciones_parto text,
  -- destete
  fecha_destete     date,
  destetados        int check (destetados        is null or destetados        >= 0),
  muertes_lactancia int check (muertes_lactancia is null or muertes_lactancia >= 0),
  peso_promedio_nacimiento numeric(5,2)
                    check (peso_promedio_nacimiento is null or peso_promedio_nacimiento >= 0),
  peso_promedio_destete    numeric(5,2)
                    check (peso_promedio_destete is null or peso_promedio_destete >= 0),
  observaciones_destete text,
  -- fallo
  fecha_fallo       date,
  motivo_fallo      text check (motivo_fallo in ('repitio_celo','vacia_al_parto','aborto','otro')),
  observaciones_fallo text,
  estado_ciclo      text not null
                    check (estado_ciclo in ('cruce','gestacion','parto','lactancia','finalizado','fallido')),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  borrado_en        timestamptz,
  actualizado_por   uuid
);
-- Un mismo ciclo/intento no se repite por madre.
create unique index ciclos_intento_uq on ciclos (madre_id, numero_ciclo, intento) where borrado_en is null;
create index ciclos_sync_idx on ciclos (granja_id, actualizado_en);
create index ciclos_madre_idx on ciclos (madre_id);

-- ---------------------------------------------------------------- triggers
-- granjas y miembros: sellan actualizado_en (manda el servidor).
-- creado_en: en INSERT se respeta el del cliente (hora real del teléfono);
-- si viene null usa now(). En UPDATE no cambia.
create function marcar_cambio() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := coalesce(new.creado_en, now());
  else
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_en := now();
  return new;
end $$;

-- madres y ciclos: además guardan quién hizo el cambio.
create function marcar_cambio_por() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := coalesce(new.creado_en, now());
  else
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_en := now();
  new.actualizado_por := usuario_actual();
  return new;
end $$;

create trigger granjas_marcar_cambio  before insert or update on granjas
  for each row execute function marcar_cambio();
create trigger miembros_marcar_cambio before insert or update on miembros
  for each row execute function marcar_cambio();
create trigger madres_marcar_cambio   before insert or update on madres
  for each row execute function marcar_cambio_por();
create trigger ciclos_marcar_cambio   before insert or update on ciclos
  for each row execute function marcar_cambio_por();

-- Un registro no puede cambiar de granja (ni un miembro de usuario).
create function impedir_cambio_granja() returns trigger
language plpgsql as $$
begin
  if new.granja_id is distinct from old.granja_id then
    raise exception 'No se puede cambiar la granja de un registro';
  end if;
  if tg_table_name = 'miembros' and new.usuario_id is distinct from old.usuario_id then
    raise exception 'No se puede cambiar el usuario de un miembro';
  end if;
  return new;
end $$;

create trigger miembros_impedir_cambio_granja before update on miembros
  for each row execute function impedir_cambio_granja();
create trigger madres_impedir_cambio_granja   before update on madres
  for each row execute function impedir_cambio_granja();
create trigger ciclos_impedir_cambio_granja   before update on ciclos
  for each row execute function impedir_cambio_granja();
