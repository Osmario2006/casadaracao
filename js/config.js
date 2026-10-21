/* Ligação com o banco de dados (Supabase).
   A "anon key" é pública por natureza: quem protege os dados são as regras do banco (supabase/setup.sql).
   Enquanto estes campos estiverem vazios, o site usa o catálogo de data/catalogo.json. */
window.CDR_CONFIG = {
  SUPABASE_URL: "https://unnmstazqkrjcuhvszza.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubm1zdGF6cWtyamN1aHZzenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDI3NDMsImV4cCI6MjEwODE3ODc0M30.A4jRlb7JtZlmIlOUO-2a0pPJe3utY5XSMuZ7eyroydw"
};
