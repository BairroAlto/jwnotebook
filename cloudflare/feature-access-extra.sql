DELETE FROM feature_access
WHERE feature_key IN ('centro_conexoes', 'partilhar_secao', 'centro_personalizacao', 'posto_ligacao_bairro');

INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('modo_normal', 'Modo Normal', 'Modo de nota com escrita sequencial padrão', 'free', 1),
  ('modo_arquivo', 'Modo Arquivo', 'Modo de nota com gavetas e prateleiras', 'free', 1),
  ('modo_post', 'Modo Post', 'Modo de nota com feed invertido', 'free', 1),
  ('modo_diario', 'Modo Diário', 'Modo de nota que agrupa ferramentas por dia', 'free', 1),
  ('modo_social', 'Modo Social', 'Modo de nota com reações em notas partilhadas', 'free', 1),
  ('modo_sentinela', 'Modo Sentinela', 'Modo de estudo profundo de A Sentinela', 'free', 1),
  ('modo_minimal', 'Modo Minimal', 'Eclipse a interface e destaca a nota', 'free', 1);

INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('conexoes_hub', 'Conexões — Hub', 'Aba Hub do Centro de Conexões', 'premium', 1),
  ('conexoes_neuronios', 'Conexões — Neurónios', 'Aba Neurónios do Centro de Conexões', 'premium', 1),
  ('conexoes_associar', 'Conexões — Associar', 'Aba Associar do Centro de Conexões', 'premium', 1),
  ('conexoes_topicos', 'Conexões — Tópicos', 'Aba Tópicos do Centro de Conexões', 'premium', 1),
  ('conexoes_referencias', 'Conexões — Referências', 'Aba Referências do Centro de Conexões', 'premium', 1),
  ('conexoes_glosa', 'Conexões — Glosa', 'Aba Glosa do Centro de Conexões', 'premium', 1),
  ('conexoes_codex', 'Conexões — Codex', 'Aba Codex do Centro de Conexões', 'premium', 1),
  ('conexoes_files', 'Conexões — Ficheiros', 'Aba Ficheiros do Centro de Conexões', 'premium', 1),
  ('partilhar_local', 'Partilhar — Local', 'Aba Local de Partilhar Secção', 'premium', 1),
  ('partilhar_share', 'Partilhar — Share', 'Aba Share de Partilhar Secção', 'premium', 1),
  ('personalizacao_destaques', 'Personalização — Destaques', 'Aba Destaques', 'premium', 1),
  ('personalizacao_focos', 'Personalização — Focos', 'Aba Focos', 'premium', 1),
  ('personalizacao_mutacao', 'Personalização — Mutação', 'Aba Mutação', 'premium', 1),
  ('personalizacao_fundir', 'Personalização — Fundir', 'Aba Fundir', 'premium', 1),
  ('personalizacao_firmamento_colorir', 'Personalização — Firmamento', 'Aba Colorir do Firmamento', 'premium', 1),
  ('personalizacao_firmamento_destaques', 'Personalização — Firmamento Destaques', 'Aba Destaques do Firmamento', 'premium', 1),
  ('posto_casa', 'Posto — Esta Casa', 'Aba Esta Casa do Posto de Ligação', 'premium', 1),
  ('posto_bairro', 'Posto — Este Bairro', 'Aba Este Bairro do Posto de Ligação', 'premium', 1),
  ('posto_casa_geral', 'Posto — Geral', 'Aba Geral da casa', 'premium', 1),
  ('posto_actas', 'Posto — Actas', 'Aba Actas da casa', 'premium', 1),
  ('posto_ficheiros', 'Posto — Ficheiros', 'Aba Ficheiros da casa', 'premium', 1),
  ('posto_historico_actas', 'Posto — Histórico de Actas', 'Histórico de Actas da casa', 'premium', 1),
  ('posto_agenda', 'Posto — Agenda', 'Aba Agenda do bairro', 'premium', 1),
  ('posto_meu_bairro', 'Posto — Meu Bairro', 'Configuração e tarefas personalizadas do Meu Bairro', 'premium', 1);

INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('painel_geral', 'Painel — Avatar', 'Perfil, avatar e identidade visual.', 'free', 1),
  ('painel_planos', 'Painel — Planos', 'Consulta e gestão dos planos da conta.', 'free', 1),
  ('painel_loja', 'Painel — Loja', 'Ferramentas adicionais para instalar na nota.', 'free', 1),
  ('painel_amigos', 'Painel — Amigos', 'Convites e gestão de amizades.', 'free', 1),
  ('painel_definicoes', 'Painel — Definições', 'Preferências da aplicação e da interface.', 'free', 1),
  ('painel_pesquisa', 'Painel — Pesquisa', 'Definições da procura inteligente.', 'free', 1),
  ('painel_manual', 'Painel — Manual', 'Manual de utilização do NotaBook.', 'free', 1),
  ('painel_fusiveis', 'Painel — Fusíveis', 'Interruptores das funcionalidades de Lists.', 'free', 1),
  ('painel_reciclagem', 'Painel — Reciclagem', 'Recuperação e eliminação de conteúdos.', 'free', 1),
  ('painel_sair', 'Painel — Sair', 'Terminar a sessão da conta.', 'free', 1);

INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES
  ('ferramenta_noticias', 'Notícias', 'Ferramenta de notícias RSS disponível na Loja.', 'free', 1),
  ('plug_wikipedia', 'Wikipédia', 'Pesquisa artigos da Wikipédia na coluna EYE.', 'free', 1),
  ('plug_wikidata', 'Wikidata', 'Pesquisa dados estruturados do Wikidata na coluna EYE.', 'free', 1),
  ('plug_wikimedia', 'Wikimedia', 'Pesquisa imagens do Wikimedia Commons na coluna EYE.', 'free', 1);
