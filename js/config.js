/* Ligação com o banco de dados (Supabase).
   A "anon key" é pública por natureza: quem protege os dados são as regras do banco (supabase/setup.sql).
   Enquanto estes campos estiverem vazios, o site usa o catálogo de data/catalogo.json. */
window.CDR_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};
