-- Permissões dos modos de nota apresentados no Laboratório.
-- Pode ser executado em instalações existentes sem alterar as restantes features.
INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('aba_laboratorio', 'Aba Laboratório', 'Acesso ao Laboratório de ferramentas e opções.', 'free', 1),
  ('aba_modelos', 'Aba Modelos', 'Acesso aos modelos guardados pelo utilizador.', 'free', 1),
  ('sites_publicos', 'Sites públicos', 'Publicação segura de notas em páginas Sites sem login', 'free', 1),
  ('modo_normal', 'Modo Normal', 'Modo de nota com escrita sequencial padrão', 'free', 1),
  ('modo_arquivo', 'Modo Arquivo', 'Modo de nota com gavetas e prateleiras', 'free', 1),
  ('modo_post', 'Modo Post', 'Modo de nota com feed invertido', 'free', 1),
  ('modo_diario', 'Modo Diário', 'Modo de nota que agrupa ferramentas por dia', 'free', 1),
  ('modo_social', 'Modo Social', 'Modo de nota com reações em notas partilhadas', 'free', 1),
  ('modo_sentinela', 'Modo Sentinela', 'Modo de estudo profundo de A Sentinela', 'free', 1),
  ('modo_minimal', 'Modo Minimal', 'Eclipse a interface e destaca a nota', 'free', 1);
