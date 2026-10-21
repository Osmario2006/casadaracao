/* ============================================================
   CATÁLOGO DA CASA DA RAÇÃO
   Para atualizar o site, edite só este arquivo.

   PRODUTOS:
   - setor: id do setor (ver SETORES abaixo)
   - nicho: id do nicho dentro do setor
   - preco: valor em reais (ex.: 89.9). Use null para "Valor no WhatsApp".
   - de: preço antigo (opcional, aparece riscado com selo "Oferta")
   - opcoes: lista de variações (opcional, ex.: cores ou fragrâncias)
   - destaque: true para aparecer em "Destaques" na página inicial
   - imagem: arquivo dentro da pasta img/
   ============================================================ */
window.CATALOGO = {
  WHATSAPP: "5579996554655",

  SETORES: [
    { id: "caes", nome: "Cães", pagina: "caes.html", icon: "i-dog",
      descricao: "Rações secas e petiscos para cães de todas as idades e portes.",
      nichos: [
        { id: "racoes", nome: "Rações" },
        { id: "petiscos", nome: "Petiscos e bifinhos" }
      ] },
    { id: "gatos", nome: "Gatos", pagina: "gatos.html", icon: "i-cat",
      descricao: "Rações, alimentos úmidos, petiscos e areia higiênica para gatos.",
      nichos: [
        { id: "racoes", nome: "Rações" },
        { id: "umidos", nome: "Úmidos e petiscos" },
        { id: "areia", nome: "Areia higiênica" }
      ] },
    { id: "aves", nome: "Pássaros e roedores", pagina: "passaros-e-roedores.html", icon: "i-bird",
      descricao: "Misturas de sementes, papinhas, alimentos para roedores e acessórios para gaiola.",
      nichos: [
        { id: "alimentacao-aves", nome: "Alimentação para aves" },
        { id: "roedores", nome: "Roedores" },
        { id: "gaiola", nome: "Brinquedos e poleiros" }
      ] },
    { id: "higiene", nome: "Higiene e beleza", pagina: "higiene-e-beleza.html", icon: "i-drop",
      descricao: "Colônias, banho a seco e acessórios para o banho do seu pet.",
      nichos: [
        { id: "perfumes", nome: "Colônias e perfumes" },
        { id: "banho", nome: "Banho" }
      ] },
    { id: "acessorios", nome: "Acessórios e brinquedos", pagina: "acessorios.html", icon: "i-ball",
      descricao: "Caixas de transporte, comedouros e brinquedos.",
      nichos: [
        { id: "transporte", nome: "Transporte" },
        { id: "comedouros", nome: "Comedouros e bebedouros" },
        { id: "brinquedos", nome: "Brinquedos" }
      ] }
  ],

  PRODUTOS: [
    { id: "quatree-supreme", setor: "caes", nicho: "racoes", marca: "Quatree", nome: "Ração Quatree Supreme Cães Adultos", info: "Frango e batata-doce · Raças médias e grandes", peso: "15 kg", preco: null, destaque: true, imagem: "quatree-supreme.webp", tags: "racao super premium cachorro" },
    { id: "pedigree-adultos", setor: "caes", nicho: "racoes", marca: "Pedigree", nome: "Ração Pedigree Adulto", info: "Carne e vegetais", peso: "10,1 kg", preco: null, imagem: "pedigree-adultos.webp", tags: "racao cachorro" },
    { id: "doguitos", setor: "caes", nicho: "petiscos", marca: "Purina", nome: "Petisco Doguitos Bifinho de Carne", info: "Petisco para cães", peso: "65 g", preco: null, imagem: "doguitos.webp", tags: "bifinho snack cachorro" },
    { id: "quatree-bifinhos", setor: "caes", nicho: "petiscos", marca: "Quatree", nome: "Quatree Snacks Bifinhos", info: "Sabor churrasco · +80% proteína", peso: "60 g", preco: null, imagem: "quatree-bifinhos.webp", tags: "petisco snack cachorro" },

    { id: "friskies", setor: "gatos", nicho: "racoes", marca: "Purina", nome: "Ração Friskies Megamix Adultos", info: "Seleção especial · 7 proteínas", peso: "1 kg", preco: null, destaque: true, imagem: "friskies.webp", tags: "racao gato" },
    { id: "chanin-salmao", setor: "gatos", nicho: "racoes", marca: "FVO", nome: "Ração Chanin Premium Gatos Adultos", info: "Sabor salmão", peso: "Consulte os tamanhos", preco: null, imagem: "chanin-salmao.webp", tags: "racao gato salmao" },
    { id: "optimum-gatos", setor: "gatos", nicho: "racoes", marca: "Optimum", nome: "Ração Optimum Gatos Castrados", info: "Sabor frango · 1+ anos", peso: "3 kg", preco: null, imagem: "optimum-gatos.webp", tags: "racao gato castrado" },
    { id: "whiskas-lata", setor: "gatos", nicho: "umidos", marca: "Whiskas", nome: "Whiskas Lata Patê", info: "Sabor carne · Adultos 1+", peso: "290 g", preco: null, imagem: "whiskas-lata.webp", tags: "umida lata pate gato" },
    { id: "dentalife", setor: "gatos", nicho: "umidos", marca: "Purina", nome: "Petisco Dentalife Gatos", info: "Cuidado oral · Sabor frango", peso: "40 g", preco: null, imagem: "dentalife.webp", tags: "snack petisco dente gato" },
    { id: "clean-cats", setor: "gatos", nicho: "areia", marca: "Clear Cats", nome: "Areia Higiênica Clear Cats Original", info: "Forma torrões e controla odor", peso: "4 kg", preco: null, imagem: "clean-cats.webp", tags: "areia granulado gato linha higienica" },

    { id: "cantoria", setor: "aves", nicho: "alimentacao-aves", marca: "Cantoria", nome: "Mistura Premium Calopsita e Agapornis", info: "Linha criadores", peso: "500 g", preco: null, destaque: true, imagem: "cantoria.webp", tags: "passaro ave semente calopsita" },
    { id: "alcon-papa", setor: "aves", nicho: "alimentacao-aves", marca: "Alcon Club", nome: "Papa para Filhotes Psitacídeos", info: "Com prebiótico e probióticos", peso: "600 g", preco: null, imagem: "alcon-papa.webp", tags: "passaro ave filhote papagaio calopsita" },
    { id: "reino-hamster", setor: "aves", nicho: "roedores", marca: "Reino das Aves", nome: "Mix Roedor Hamster", info: "Grãos integrais e frutas", peso: "500 g", preco: null, imagem: "reino-hamster.webp", tags: "roedor hamster" },
    { id: "balanco-passaro", setor: "aves", nicho: "gaiola", marca: "Acessório", nome: "Balanço com Poleiro e Miçangas", info: "Para calopsitas e periquitos", peso: "Cores variadas", preco: null, imagem: "balanco-passaro.webp", tags: "passaro brinquedo calopsita" },

    { id: "sanol-colonia", setor: "higiene", nicho: "perfumes", marca: "Sanol Dog", nome: "Colônia Sanol Dog", info: "Perfume para cães", peso: "120 mL", preco: 12.99, de: 18.99, opcoes: ["Fêmea", "Macho"], destaque: true, imagem: "sanol-colonia.webp", tags: "perfume colonia cachorro oferta" },
    { id: "petclean-banho", setor: "higiene", nicho: "banho", marca: "Pet Clean", nome: "Banho a Seco Pet Clean", info: "Para cães e gatos", peso: "240 mL", preco: null, opcoes: ["Hidratação", "Maciez", "Nutrição"], imagem: "petclean-banho.webp", tags: "banho seco shampoo" },
    { id: "escova-silicone", setor: "higiene", nicho: "banho", marca: "Acessório", nome: "Escova de Banho em Silicone", info: "Com reservatório para shampoo", peso: "Unidade", preco: null, opcoes: ["Rosa", "Verde"], imagem: "escova-silicone.webp", tags: "escova banho" },

    { id: "caixa-transporte", setor: "acessorios", nicho: "transporte", marca: "Plast Pet", nome: "Caixa de Transporte Plast Pet", info: "Para gatos e cães pequenos", peso: "Nº 2", preco: null, imagem: "caixa-transporte.webp", tags: "transporte caixa" },
    { id: "comedouro-inox", setor: "acessorios", nicho: "comedouros", marca: "Acessório", nome: "Comedouro Duplo Inox com Suporte", info: "Altura regulável", peso: "Unidade", preco: null, imagem: "comedouro-inox.webp", tags: "comedouro bebedouro tigela" },
    { id: "abacate-catnip", setor: "acessorios", nicho: "brinquedos", marca: "Brinquedo", nome: "Brinquedo Abacate com Catnip", info: "Bola de erva-do-gato giratória", peso: "Unidade", preco: null, destaque: true, imagem: "abacate-catnip.webp", tags: "gato brinquedo catnip erva" }
  ]
};
