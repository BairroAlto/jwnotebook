-- Plugs disponíveis na Loja e controlados pelo painel de Administração.
INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('plug_wikipedia', 'Wikipédia', 'Pesquisa artigos da Wikipédia na coluna EYE.', 'free', 1),
  ('plug_wikidata', 'Wikidata', 'Pesquisa dados estruturados do Wikidata na coluna EYE.', 'free', 1),
  ('plug_wikimedia', 'Wikimedia', 'Pesquisa imagens do Wikimedia Commons na coluna EYE.', 'free', 1);
