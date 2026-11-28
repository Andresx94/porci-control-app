-- PorciControl: arreglo (Postgres estándar).
-- La versión anterior leía new.usuario_id también en madres y ciclos, que no tienen esa columna,
-- y hacía fallar cualquier UPDATE (o upsert sobre una fila existente) en esas tablas.
create or replace function impedir_cambio_granja() returns trigger
language plpgsql as $$
begin
  if new.granja_id is distinct from old.granja_id then
    raise exception 'No se puede cambiar la granja de un registro';
  end if;
  -- Solo miembros tiene usuario_id; se lee vía jsonb para no referenciar el campo en otras tablas.
  if tg_table_name = 'miembros'
     and (to_jsonb(new) ->> 'usuario_id') is distinct from (to_jsonb(old) ->> 'usuario_id') then
    raise exception 'No se puede cambiar el usuario de un miembro';
  end if;
  return new;
end $$;
