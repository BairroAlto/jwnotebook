-- Ferramentas publicadas na Loja do Painel de Utilizador.
INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('ferramenta_noticias', 'Notícias', 'Ferramenta de notícias RSS disponível na Loja.', 'free', 1),
  ('ferramenta_tempo', 'Tempo', 'Ferramenta meteorológica com atualização diária disponível na Loja.', 'free', 1),
  ('ferramenta_inspirador', 'Inspirador', 'Citações da Wikiquote por autor, tema ou aleatórias.', 'free', 1),
  ('ferramenta_gmail', 'Gmail', 'Consulta os emails recentes da conta Google em modo somente leitura.', 'free', 1),
  ('ferramenta_habito', 'Hábito', 'Categorias e calendário mensal para acompanhar hábitos.', 'free', 1),
  ('plug_wikipedia', 'Wikipédia', 'Pesquisa artigos da Wikipédia na coluna EYE.', 'free', 1),
  ('plug_wikidata', 'Wikidata', 'Pesquisa dados estruturados do Wikidata na coluna EYE.', 'free', 1),
  ('plug_wikimedia', 'Wikimedia', 'Pesquisa imagens do Wikimedia Commons na coluna EYE.', 'free', 1);
