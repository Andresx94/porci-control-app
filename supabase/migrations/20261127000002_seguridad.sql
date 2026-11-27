-- PorciControl: seguridad por filas (Postgres estándar; usa usuario_actual()).

-- Helpers: security definer para leer miembros sin recursión de RLS.
create function es_miembro(p_granja uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from miembros m join granjas g on g.id = m.granja_id
    where m.granja_id = p_granja
      and m.usuario_id = usuario_actual()
      and m.borrado_en is null
      and g.borrado_en is null
  )
$$;

create function es_dueno(p_granja uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from miembros m join granjas g on g.id = m.granja_id
    where m.granja_id = p_granja
      and m.usuario_id = usuario_actual()
      and m.rol = 'dueno'
      and m.borrado_en is null
      and g.borrado_en is null
  )
$$;

alter table granjas  enable row level security;
alter table miembros enable row level security;
alter table madres   enable row level security;
alter table ciclos   enable row level security;

-- granjas: las crea el admin con SQL; no hay INSERT ni DELETE.
create policy granjas_select on granjas for select using (es_miembro(id));
create policy granjas_update on granjas for update
  using (es_dueno(id)) with check (es_dueno(id));

-- miembros: solo el dueño administra; sin DELETE (se usa borrado_en).
create policy miembros_select on miembros for select using (es_miembro(granja_id));
create policy miembros_insert on miembros for insert with check (es_dueno(granja_id));
create policy miembros_update on miembros for update
  using (es_dueno(granja_id)) with check (es_dueno(granja_id));

-- madres: cualquier miembro lee y escribe; sin DELETE (borrar = borrado_en).
create policy madres_select on madres for select using (es_miembro(granja_id));
create policy madres_insert on madres for insert with check (es_miembro(granja_id));
create policy madres_update on madres for update
  using (es_miembro(granja_id)) with check (es_miembro(granja_id));

-- ciclos: igual que madres.
create policy ciclos_select on ciclos for select using (es_miembro(granja_id));
create policy ciclos_insert on ciclos for insert with check (es_miembro(granja_id));
create policy ciclos_update on ciclos for update
  using (es_miembro(granja_id)) with check (es_miembro(granja_id));

-- Solo el dueño borra o restaura (poner/quitar borrado_en).
-- Sin usuario (contexto admin/servidor) no se restringe.
-- El orden alfabético de los triggers no altera el resultado.
create function solo_dueno_borra() returns trigger
language plpgsql as $$
begin
  if usuario_actual() is null then
    return new;
  end if;
  if ((tg_op = 'INSERT' and new.borrado_en is not null)
      or (tg_op = 'UPDATE' and new.borrado_en is distinct from old.borrado_en))
     and not es_dueno(new.granja_id) then
    raise exception 'Solo el dueño puede borrar o restaurar';
  end if;
  return new;
end $$;

create trigger madres_solo_dueno_borra before insert or update on madres
  for each row execute function solo_dueno_borra();
create trigger ciclos_solo_dueno_borra before insert or update on ciclos
  for each row execute function solo_dueno_borra();
