-- Casa da Ração — reforço de segurança do banco
-- Rode no SQL Editor depois de setup.sql. Pode ser rodado de novo sem problema.

begin;

-- 1) Dono só altera com o código de verificação, quando a verificação em duas etapas está ativa
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
     );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) Validações: o banco recusa dados fora do formato, mesmo vindos de uma conta com acesso
alter table public.produtos drop constraint if exists produtos_validos;
alter table public.produtos add constraint produtos_validos check (
  id ~ '^[a-z0-9][a-z0-9-]{0,59}$'
  and setor in ('caes', 'gatos', 'aves', 'higiene', 'acessorios')
  and nicho ~ '^[a-z0-9][a-z0-9-]{0,39}$'
  and char_length(nome) between 1 and 120
  and char_length(marca) <= 60
  and char_length(info) <= 200
  and char_length(peso) between 1 and 40
  and (preco is null or (preco >= 0 and preco <= 99999.99))
  and (de is null or (preco is not null and de > preco and de <= 99999.99))
  and (opcoes is null or (cardinality(opcoes) between 1 and 12 and array_position(opcoes, null) is null))
  and (tags is null or char_length(tags) <= 300)
  and (imagem = '' or imagem ~ '^[A-Za-z0-9._-]{1,120}$'
       or imagem ~ '^https://unnmstazqkrjcuhvszza\.supabase\.co/storage/v1/object/public/produtos/[A-Za-z0-9._-]{1,120}$')
  and ordem between -1000 and 100000
);

create or replace function public.opcoes_validas(o text[]) returns boolean
language sql immutable set search_path = public as $$
  select o is null or not exists (select 1 from unnest(o) x where char_length(x) not between 1 and 40);
$$;
alter table public.produtos drop constraint if exists produtos_opcoes_validas;
alter table public.produtos add constraint produtos_opcoes_validas check (public.opcoes_validas(opcoes));

alter table public.promocoes drop constraint if exists promocoes_validas;
alter table public.promocoes add constraint promocoes_validas check (
  id ~ '^[a-z0-9][a-z0-9-]{0,59}$'
  and char_length(titulo) between 1 and 120
  and char_length(texto) <= 300
  and char_length(selo_topo) <= 10
  and char_length(selo_valor) <= 7
  and cor in ('amarelo', 'verde')
  and ordem between -1000 and 100000
);
alter table public.promocoes drop constraint if exists promocoes_produto_fk;
update public.promocoes set produto = null where produto is not null and produto not in (select id from public.produtos);
alter table public.promocoes add constraint promocoes_produto_fk foreign key (produto) references public.produtos(id) on delete set null;

-- 3) Data de alteração sempre definida pelo servidor
create or replace function public.marca_atualizacao() returns trigger
language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end; $$;
drop trigger if exists produtos_atualizado on public.produtos;
create trigger produtos_atualizado before insert or update on public.produtos for each row execute function public.marca_atualizacao();
drop trigger if exists promocoes_atualizado on public.promocoes;
create trigger promocoes_atualizado before insert or update on public.promocoes for each row execute function public.marca_atualizacao();

-- 4) Produtos e promoções ocultos deixam de ser lidos por visitantes
drop policy if exists "todos veem produtos" on public.produtos;
drop policy if exists "visitantes veem produtos ativos" on public.produtos;
create policy "visitantes veem produtos ativos" on public.produtos for select using (ativo or public.is_admin());
drop policy if exists "todos veem promoções" on public.promocoes;
drop policy if exists "visitantes veem promoções ativas" on public.promocoes;
create policy "visitantes veem promoções ativas" on public.promocoes for select using (ativo or public.is_admin());

-- 5) Fotos: só imagens JPG, PNG ou WebP de até 2 MB
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
 where id = 'produtos';

-- 6) Histórico de alterações (somente leitura para o dono; ninguém edita nem apaga)
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  tabela text not null,
  registro text not null,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  user_id uuid,
  email text,
  antes jsonb,
  depois jsonb
);
alter table public.auditoria enable row level security;
drop policy if exists "dono lê o histórico" on public.auditoria;
create policy "dono lê o histórico" on public.auditoria for select using (public.is_admin());
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;
create index if not exists auditoria_em_idx on public.auditoria (em desc);

create or replace function public.registra_auditoria() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  insert into public.auditoria (tabela, registro, acao, user_id, email, antes, depois)
  values (
    tg_table_name,
    coalesce(case when tg_op = 'DELETE' then old.id else new.id end, '?'),
    tg_op, auth.uid(), v_email,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'atualizado_em' end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'atualizado_em' end
  );
  return null;
end; $$;

drop trigger if exists produtos_auditoria on public.produtos;
create trigger produtos_auditoria after insert or update or delete on public.produtos
  for each row execute function public.registra_auditoria();
drop trigger if exists promocoes_auditoria on public.promocoes;
create trigger promocoes_auditoria after insert or update or delete on public.promocoes
  for each row execute function public.registra_auditoria();

-- 7) Tabela de donos: ninguém altera pela API (só pelo painel do Supabase)
revoke insert, update, delete on public.admins from anon, authenticated;
revoke all on function public.opcoes_validas(text[]) from public;
grant execute on function public.opcoes_validas(text[]) to anon, authenticated;

commit;

-- Conferência
select
  (select count(*) from public.produtos) as produtos,
  (select count(*) from public.promocoes) as promocoes,
  (select file_size_limit from storage.buckets where id = 'produtos') as limite_foto,
  (select count(*) from pg_trigger where tgname like '%auditoria') as gatilhos_auditoria,
  (select count(*) from pg_policies where schemaname = 'public') as regras;
