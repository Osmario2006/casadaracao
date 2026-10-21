# Casa da Ração — site de pedidos

Site da Casa da Ração (Av. Camilo Calazans, 394, Novo Paraíso, Aracaju/SE).
O cliente navega pelos setores, monta o pedido e envia a mensagem pronta para o WhatsApp da loja.

Publicado com GitHub Pages: https://osmario2006.github.io/casadaracao/

## Páginas
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Início: promoções no topo, setores, destaques, horários e avisos |
| `painel.html` | Painel do dono (restrito por chave de acesso) |
| `caes.html` | Cães: rações, petiscos e bifinhos |
| `gatos.html` | Gatos: rações, úmidos e petiscos, areia higiênica |
| `passaros-e-roedores.html` | Alimentação para aves, roedores, brinquedos e poleiros |
| `higiene-e-beleza.html` | Colônias e perfumes, banho |
| `acessorios.html` | Transporte, comedouros e bebedouros, brinquedos |

O pedido fica salvo no navegador do cliente, então ele pode adicionar produtos em páginas diferentes.

## Painel do dono (`painel.html`)
Endereço: https://osmario2006.github.io/casadaracao/painel.html (não tem link no site).

Login com **e-mail e senha**. No painel dá para alterar preços, trocar fotos, cadastrar, ocultar e excluir produtos e editar as promoções do topo da página inicial. Cada alteração é salva na hora e já aparece no site.

### Banco de dados (Supabase)
Produtos, promoções, fotos e login ficam num projeto Supabase gratuito.
1. Crie o projeto em https://supabase.com e rode `supabase/setup.sql` no **SQL Editor** (cria as tabelas, as regras de segurança, o armazenamento de fotos e copia o catálogo atual).
2. Em **Authentication → Users → Add user**, crie o usuário do dono (e-mail e senha, marcando auto-confirmar).
3. Rode `supabase/admin.sql` para dar a esse usuário permissão de alterar o site.
4. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**.
5. Em **Authentication → URL Configuration**, coloque `https://osmario2006.github.io/casadaracao/painel.html` em **Site URL** (usado no link de "Esqueci minha senha").
6. Copie **Project URL** e **anon public key** (Project Settings → API) para `js/config.js`.

Enquanto `js/config.js` estiver vazio, o site usa o catálogo de `data/catalogo.json`.

## Como editar à mão
Os setores e o WhatsApp ficam em **`data/catalogo.json`**. Os produtos também ficam lá como reserva, caso o banco esteja fora do ar:
- `preco`: valor em reais (ex.: `89.9`). Use `null` para mostrar "Valor no WhatsApp".
- `de`: preço antigo (opcional), aparece riscado com o selo "Oferta".
- `nicho`: em que grupo o produto aparece dentro da página do setor.
- `destaque: true`: aparece em "Destaques" na página inicial.
- `ativo: false`: esconde o produto do site sem apagar.
- `imagem`: nome do arquivo dentro da pasta `img/` (foto quadrada com fundo branco, ~600×600).

Para criar um nicho novo, adicione-o na lista `nichos` do setor. As páginas montam a vitrine sozinhas a partir dessa lista.

## Estrutura
```
css/style.css     estilos de todas as páginas
data/catalogo.json  setores, WhatsApp e cópia de reserva do catálogo
js/config.js      endereço e chave pública do Supabase
supabase/         SQL para criar o banco
js/app.js         vitrine, busca, menu lateral e pedido pelo WhatsApp
js/painel.js      painel do dono
img/              fotos dos produtos
```
