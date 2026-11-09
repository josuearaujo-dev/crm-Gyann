-- Diagnóstico: leads/reuniões (ex.: Mohamed Hussein) e por que podem
-- não entrar na taxa de comparecimento (Formulario-BR + SETEMBRO).
-- Nota: meetings NÃO tem coluna title — o nome fica em leads.name

-- 1) Buscar os nomes citados na agenda
SELECT
  m.id AS meeting_id,
  m.scheduled_at,
  m.status,
  m.meeting_type,
  m.lead_id,
  l.name AS lead_name,
  l.created_at AS lead_created_at,
  l.excluded_from_reports,
  l.is_lost,
  ls.name AS fonte,
  pc.name AS coluna
FROM meetings m
LEFT JOIN leads l ON l.id = m.lead_id
LEFT JOIN lead_sources ls ON ls.id = l.source_id
LEFT JOIN pipeline_columns pc ON pc.id = l.column_id
WHERE m.scheduled_at >= '2026-09-01 00:00:00+00'
  AND m.scheduled_at <  '2026-09-12 00:00:00+00'
  AND (
    coalesce(l.name, '') ILIKE '%mohamed%'
    OR coalesce(l.name, '') ILIKE '%hussein%'
    OR coalesce(l.name, '') ILIKE '%vitor%'
    OR coalesce(l.name, '') ILIKE '%hugo%'
    OR coalesce(l.name, '') ILIKE '%júnior%'
    OR coalesce(l.name, '') ILIKE '%junior%'
  )
ORDER BY m.scheduled_at;

-- 2) Todas as reuniões da janela SETEMBRO (para ver status + motivo do filtro)
SELECT
  m.scheduled_at::date AS dia,
  m.status,
  coalesce(l.name, '(sem lead)') AS nome,
  ls.name AS fonte,
  l.created_at::date AS lead_criado_em,
  CASE
    WHEN l.id IS NULL THEN 'sem lead vinculado'
    WHEN coalesce(l.excluded_from_reports, false) THEN 'excluido dos relatorios'
    WHEN coalesce(l.is_lost, false) THEN 'perdido'
    WHEN ls.name IS NULL OR (
      ls.name NOT ILIKE '%Formulario-BR%'
    ) THEN 'outra fonte'
    WHEN l.created_at < '2026-09-01 00:00:00+00'
      OR l.created_at >= '2026-09-12 00:00:00+00' THEN 'lead fora da coorte (created_at)'
    ELSE 'entra na coorte Formulario-BR + SETEMBRO'
  END AS motivo_filtro
FROM meetings m
LEFT JOIN leads l ON l.id = m.lead_id
LEFT JOIN lead_sources ls ON ls.id = l.source_id
WHERE m.scheduled_at >= '2026-09-01 00:00:00+00'
  AND m.scheduled_at <  '2026-09-12 00:00:00+00'
  AND coalesce(m.status, '') <> 'cancelled'
ORDER BY m.scheduled_at;
