INSERT OR IGNORE INTO feature_access (feature_key, label, description, min_plan, active)
VALUES (
  'publicacoes_historicas',
  'Publicações históricas',
  'A Sentinela e Despertai! anteriores a 2000 em Lists e X-SAT',
  'premium',
  1
);

UPDATE feature_access
SET description = 'A Sentinela e Despertai! anteriores a 2000 em Lists e X-SAT',
    updated_at = CURRENT_TIMESTAMP
WHERE feature_key = 'publicacoes_historicas';
