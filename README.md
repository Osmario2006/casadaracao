# Casa da Ração — site de pedidos

Site da Casa da Ração (Av. Camilo Calazans, 394, Novo Paraíso, Aracaju/SE).
O cliente navega pelos setores, monta o pedido e envia a mensagem pronta para o WhatsApp da loja.

Publicado com GitHub Pages: https://osmario2006.github.io/casadaracao/

## Páginas
| Arquivo | Conteúdo |
|---|---|
| `index.html` | Início: setores, promoções, destaques, horários e avisos |
| `caes.html` | Cães: rações, petiscos e bifinhos |
| `gatos.html` | Gatos: rações, úmidos e petiscos, areia higiênica |
| `passaros-e-roedores.html` | Alimentação para aves, roedores, brinquedos e poleiros |
| `higiene-e-beleza.html` | Colônias e perfumes, banho |
| `acessorios.html` | Transporte, comedouros e bebedouros, brinquedos |

O pedido fica salvo no navegador do cliente, então ele pode adicionar produtos em páginas diferentes.

## Como editar produtos, preços e setores
Tudo fica em **`js/produtos.js`**:
- `preco`: valor em reais (ex.: `89.9`). Use `null` para mostrar "Valor no WhatsApp".
- `de`: preço antigo (opcional), aparece riscado com o selo "Oferta".
- `nicho`: em que grupo o produto aparece dentro da página do setor.
- `destaque: true`: aparece em "Destaques" na página inicial.
- `imagem`: nome do arquivo dentro da pasta `img/` (foto quadrada com fundo branco, ~600×600).

Para criar um nicho novo, adicione-o na lista `nichos` do setor. As páginas montam a vitrine sozinhas a partir dessa lista.

## Estrutura
```
css/style.css     estilos de todas as páginas
js/produtos.js    catálogo (setores, nichos e produtos)
js/app.js         vitrine, busca, menu lateral e pedido pelo WhatsApp
img/              fotos dos produtos
```
