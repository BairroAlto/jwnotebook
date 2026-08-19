-- Permissões das abas do Painel de Utilizador.
-- A aba Administração não entra nesta lista: é exclusiva do administrador.
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
