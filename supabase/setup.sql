-- Casa da Ração — estrutura do banco (Supabase)
-- Rode este arquivo inteiro no SQL Editor do projeto Supabase, uma única vez.

-- Quem pode alterar o site: só usuários listados aqui
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "admin vê o próprio registro" on public.admins for select using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Produtos
create table if not exists public.produtos (
  id text primary key,
  setor text not null,
  nicho text not null,
  marca text not null default '',
  nome text not null,
  info text not null default '',
  peso text not null default 'Unidade',
  preco numeric(10,2),
  de numeric(10,2),
  opcoes text[],
  destaque boolean not null default false,
  ativo boolean not null default true,
  imagem text not null default '',
  tags text,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.produtos enable row level security;
create policy "todos veem produtos" on public.produtos for select using (true);
create policy "admin insere produtos" on public.produtos for insert with check (public.is_admin());
create policy "admin altera produtos" on public.produtos for update using (public.is_admin()) with check (public.is_admin());
create policy "admin exclui produtos" on public.produtos for delete using (public.is_admin());

-- Promoções do topo da página inicial
create table if not exists public.promocoes (
  id text primary key,
  titulo text not null,
  texto text not null default '',
  selo_topo text not null default '',
  selo_valor text not null default '',
  produto text,
  cor text not null default 'amarelo',
  ativo boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.promocoes enable row level security;
create policy "todos veem promoções" on public.promocoes for select using (true);
create policy "admin insere promoções" on public.promocoes for insert with check (public.is_admin());
create policy "admin altera promoções" on public.promocoes for update using (public.is_admin()) with check (public.is_admin());
create policy "admin exclui promoções" on public.promocoes for delete using (public.is_admin());

-- Fotos dos produtos (públicas para leitura, só o admin envia)
insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true) on conflict (id) do nothing;
create policy "fotos públicas" on storage.objects for select using (bucket_id = 'produtos');
create policy "admin envia fotos" on storage.objects for insert with check (bucket_id = 'produtos' and public.is_admin());
create policy "admin altera fotos" on storage.objects for update using (bucket_id = 'produtos' and public.is_admin());
create policy "admin exclui fotos" on storage.objects for delete using (bucket_id = 'produtos' and public.is_admin());

-- Catálogo inicial (o mesmo que está no site hoje)
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('quatree-supreme', 'caes', 'racoes', 'Quatree', 'Ração Quatree Supreme Cães Adultos', 'Frango e batata-doce · Super premium, sem corantes', '15 kg', null, null, array['Raças médias e grandes','Raças pequenas']::text[], true, true, 'quatree-supreme.webp', 'racao super premium cachorro', 0) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('pedigree-adultos', 'caes', 'racoes', 'Pedigree', 'Ração Pedigree Adulto', 'Carne e vegetais', '10,1 kg', null, null, null, false, true, 'pedigree-adultos.webp', 'racao cachorro', 1) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('doguitos', 'caes', 'petiscos', 'Purina', 'Petisco Doguitos Bifinho de Carne', 'Petisco para cães', '65 g', null, null, null, false, true, 'doguitos.webp', 'bifinho snack cachorro', 2) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('filezitos', 'caes', 'petiscos', 'Pedigree', 'Petisco Pedigree Filezitos Carne', 'Textura macia · Sem corantes artificiais', '60 g', null, null, null, false, true, 'filezitos.webp', 'petisco bifinho felizitos filezitos cachorro carne', 3) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('quatree-bifinhos', 'caes', 'petiscos', 'Quatree', 'Quatree Snacks Bifinhos', '+80% proteína · Com prebiótico', '60 g', null, null, array['Churrasco','Carne','Frango']::text[], false, true, 'quatree-bifinhos.webp', 'petisco snack cachorro', 4) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('friskies', 'gatos', 'racoes', 'Purina', 'Ração Friskies para Gatos', 'Purina · Pacote econômico', '850 g', null, null, array['Megamix Adultos','Filhotes']::text[], true, true, 'friskies.webp', 'racao gato', 5) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('chanin-salmao', 'gatos', 'racoes', 'FVO', 'Ração Chanin Premium Gatos Adultos', 'Sabor salmão', 'Consulte os tamanhos', null, null, null, false, true, 'chanin-salmao.webp', 'racao gato salmao', 6) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('optimum-gatos', 'gatos', 'racoes', 'Optimum', 'Ração Optimum Gatos Castrados', 'Sabor frango · 1+ anos', '3 kg', null, null, null, false, true, 'optimum-gatos.webp', 'racao gato castrado', 7) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('whiskas-lata', 'gatos', 'umidos', 'Whiskas', 'Whiskas Lata Patê', 'Alimento úmido · Adultos 1+', '290 g', null, null, array['Carne','Atum','Frango','Peixe']::text[], false, true, 'whiskas-lata.webp', 'umida lata pate gato', 8) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('quatree-sache', 'gatos', 'umidos', 'Quatree', 'Sachê Quatree Supreme Gatos', 'Frango ao molho · Super premium', '85 g', 2.99, null, null, true, true, 'quatree-sache.webp', 'sache umido gato frango oferta leve 4', 9) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('quatree-nuggets', 'gatos', 'umidos', 'Quatree', 'Quatree Snacks Nuggets Gatos', 'Previne bola de pelo · Ajuda na limpeza dos dentes', 'Consulte os tamanhos', null, null, array['Salmão','Frango','Carne']::text[], false, true, 'quatree-nuggets.webp', 'petisco snack gato bola de pelo', 10) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('dentalife', 'gatos', 'umidos', 'Purina', 'Petisco Dentalife Gatos', 'Cuidado oral · Sabor frango', '40 g', null, null, null, false, true, 'dentalife.webp', 'snack petisco dente gato', 11) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('clean-cats', 'gatos', 'areia', 'Clear Cats', 'Areia Higiênica Clear Cats Original', 'Forma torrões e controla odor', '4 kg', null, null, null, false, true, 'clean-cats.webp', 'areia granulado gato linha higienica', 12) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('cantoria', 'aves', 'alimentacao-aves', 'Cantoria', 'Mistura Premium Calopsita e Agapornis', 'Linha criadores', '500 g', null, null, null, true, true, 'cantoria.webp', 'passaro ave semente calopsita', 13) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('alcon-papa', 'aves', 'alimentacao-aves', 'Alcon Club', 'Papa para Filhotes Psitacídeos', 'Com prebiótico e probióticos', '600 g', null, null, null, false, true, 'alcon-papa.webp', 'passaro ave filhote papagaio calopsita', 14) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('reino-hamster', 'aves', 'roedores', 'Reino das Aves', 'Mix Roedor Hamster', 'Grãos integrais e frutas', '500 g', null, null, null, false, true, 'reino-hamster.webp', 'roedor hamster', 15) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('balanco-passaro', 'aves', 'gaiola', 'Artesanal', 'Poleiro Artesanal com Miçangas', 'Feito à mão · Balanço para gaiola', 'Cores variadas', null, null, array['Calopsita','Papagaio']::text[], false, true, 'balanco-passaro.webp', 'passaro brinquedo calopsita', 16) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('sanol-colonia', 'higiene', 'perfumes', 'Sanol Dog', 'Colônia Sanol Dog', 'Perfume para cães', '120 mL', 12.99, 18.99, array['Fêmea','Macho']::text[], true, true, 'sanol-colonia.webp', 'perfume colonia cachorro oferta', 17) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('petclean-banho', 'higiene', 'banho', 'Pet Clean', 'Banho a Seco Pet Clean', 'Para cães e gatos', '240 mL', null, null, array['Hidratação','Maciez','Nutrição']::text[], false, true, 'petclean-banho.webp', 'banho seco shampoo', 18) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('escova-silicone', 'higiene', 'banho', 'Luna', 'Escova de Banho em Silicone', 'Com reservatório para shampoo', 'Unidade', null, null, array['Rosa','Verde']::text[], false, true, 'escova-silicone.webp', 'escova banho', 19) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('caixa-transporte', 'acessorios', 'transporte', 'Plast Pet', 'Caixa de Transporte Plast Pet', 'Para gatos e cães pequenos · Consulte as cores', 'Nº 2', null, null, null, false, true, 'caixa-transporte.webp', 'transporte caixa', 20) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('comedouro-inox', 'acessorios', 'comedouros', 'Acessório', 'Comedouro Duplo Inox com Suporte', 'Altura regulável', 'Unidade', null, null, null, false, true, 'comedouro-inox.webp', 'comedouro bebedouro tigela', 21) on conflict (id) do nothing;
insert into public.produtos (id,setor,nicho,marca,nome,info,peso,preco,de,opcoes,destaque,ativo,imagem,tags,ordem) values ('abacate-catnip', 'acessorios', 'brinquedos', 'Brinquedo', 'Brinquedo Abacate com Catnip', 'Bola de erva-do-gato giratória', 'Unidade', null, null, null, true, true, 'abacate-catnip.webp', 'gato brinquedo catnip erva', 22) on conflict (id) do nothing;
insert into public.promocoes (id,titulo,texto,selo_topo,selo_valor,produto,cor,ativo,ordem) values ('saches-leve-4', 'Sachês para gatos: leve 4 por R$ 10', 'Unidade a R$ 2,99. Pagamento em dinheiro ou Pix, enquanto durar o estoque.', 'LEVE 4', 'R$10', 'quatree-sache', 'amarelo', true, 0) on conflict (id) do nothing;
insert into public.promocoes (id,titulo,texto,selo_topo,selo_valor,produto,cor,ativo,ordem) values ('sanol-colonia', 'Colônias Sanol Dog 120 mL', 'De R$ 18,99 por R$ 12,99. Fêmea ou Macho.', 'POR', '12,99', 'sanol-colonia', 'verde', true, 1) on conflict (id) do nothing;
