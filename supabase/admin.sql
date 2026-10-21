-- Rode DEPOIS de criar o seu usuário em Authentication > Users.
-- Dá permissão de dono a todos os usuários cadastrados (deve haver só o seu).
insert into public.admins (user_id) select id from auth.users on conflict do nothing;
select u.email, a.criado_em from public.admins a join auth.users u on u.id = a.user_id;
