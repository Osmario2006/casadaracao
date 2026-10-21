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

No painel dá para alterar preços, trocar fotos, cadastrar, ocultar e excluir produtos e editar as promoções do topo da página inicial.
Ao tocar em **Publicar no site**, o painel grava as mudanças neste repositório e o GitHub Pages republica o site em 1 a 2 minutos.

Para entrar, o painel pede uma **chave de acesso** (fine-grained personal access token) criada na conta dona do repositório:
1. https://github.com/settings/personal-access-tokens/new
2. Repository access: **Only select repositories → casadaracao**
3. Permissions → Repository → **Contents: Read and write**
4. Gere a chave e cole no painel. Ela fica salva só no aparelho de quem entrou.

## Como editar à mão
O catálogo fica em **`data/catalogo.json`** (o painel edita esse arquivo):
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
data/catalogo.json  catálogo (promoções, setores, nichos e produtos)
js/app.js         vitrine, busca, menu lateral e pedido pelo WhatsApp
js/painel.js      painel do dono
img/              fotos dos produtos
```
