do $$
declare
  col_data_type text;
  col_udt_name text;
  type_schema text;
  type_name text;
  status_check_name text;
begin
  select c.data_type, c.udt_name
    into col_data_type, col_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'invoices'
    and c.column_name = 'status';

  if col_data_type = 'USER-DEFINED' then
    select n.nspname, t.typname
      into type_schema, type_name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = col_udt_name
    limit 1;

    if type_name is not null then
      if not exists (
        select 1
        from pg_enum e
        join pg_type t2 on t2.oid = e.enumtypid
        join pg_namespace n2 on n2.oid = t2.typnamespace
        where n2.nspname = type_schema
          and t2.typname = type_name
          and e.enumlabel = 'pending'
      ) then
        execute format('alter type %I.%I add value %L', type_schema, type_name, 'pending');
      end if;
    end if;

  else
    select c.conname
      into status_check_name
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = 'invoices'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
      and pg_get_constraintdef(c.oid) ilike '%paid%'
    limit 1;

    if status_check_name is not null then
      execute format('alter table public.invoices drop constraint %I', status_check_name);
      execute format(
        'alter table public.invoices add constraint %I check (status in (''draft'',''sent'',''pending'',''paid'',''cancelled''))',
        status_check_name
      );
    end if;
  end if;
end $$;
