-- Diagnóstico reuniões — Campanha "4 CAMPA OUT/NOV BR"
-- Janela da tela: 2026-10-31 a 2026-11-03 | Formulário: Todos
-- Conta reuniões na janela (não exige lead criado na coorte).

-- 1) Resumo por status
SELECT
  m.status,
  count(*) AS qtd
FROM meetings m
JOIN leads l ON l.id = m.lead_id
WHERE coalesce(l.excluded_from_reports, false) = false
  AND coalesce(l.is_lost, false) = false
  AND coalesce(m.status, '') <> 'cancelled'
  AND (
    (m.scheduled_at >= '2026-10-31 00:00:00+00' AND m.scheduled_at < '2026-11-04 00:00:00+00')
    OR (m.created_at >= '2026-10-31 00:00:00+00' AND m.created_at < '2026-11-04 00:00:00+00')
  )
GROUP BY m.status
ORDER BY qtd DESC;

-- 2) Lista completa das reuniões na janela
SELECT
  m.id,
  m.scheduled_at,
  m.created_at AS meeting_created_at,
  m.status,
  l.name AS lead_name,
  l.created_at AS lead_created_at,
  ls.name AS fonte,
  CASE
    WHEN l.created_at >= '2026-10-31 00:00:00+00'
     AND l.created_at <  '2026-11-04 00:00:00+00'
      THEN 'lead na coorte da campanha'
    ELSE 'lead fora da coorte (entra na conta de reuniões da janela)'
  END AS coorte_lead
FROM meetings m
JOIN leads l ON l.id = m.lead_id
LEFT JOIN lead_sources ls ON ls.id = l.source_id
WHERE coalesce(l.excluded_from_reports, false) = false
  AND coalesce(l.is_lost, false) = false
  AND coalesce(m.status, '') <> 'cancelled'
  AND (
    (m.scheduled_at >= '2026-10-31 00:00:00+00' AND m.scheduled_at < '2026-11-04 00:00:00+00')
    OR (m.created_at >= '2026-10-31 00:00:00+00' AND m.created_at < '2026-11-04 00:00:00+00')
  )
ORDER BY m.scheduled_at;

-- 3) Taxas no modelo novo (contagem de reuniões) + vendas da coorte
WITH m AS (
  SELECT m.status
  FROM meetings m
  JOIN leads l ON l.id = m.lead_id
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND coalesce(m.status, '') <> 'cancelled'
    AND (
      (m.scheduled_at >= '2026-10-31 00:00:00+00' AND m.scheduled_at < '2026-11-04 00:00:00+00')
      OR (m.created_at >= '2026-10-31 00:00:00+00' AND m.created_at < '2026-11-04 00:00:00+00')
    )
),
leads_coorte AS (
  SELECT count(*) AS total_leads
  FROM leads l
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND l.created_at >= '2026-10-31 00:00:00+00'
    AND l.created_at <  '2026-11-04 00:00:00+00'
),
sales AS (
  SELECT count(*) AS vendas
  FROM leads l
  LEFT JOIN pipeline_columns pc ON pc.id = l.column_id
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND l.created_at >= '2026-10-31 00:00:00+00'
    AND l.created_at <  '2026-11-04 00:00:00+00'
    AND (
      l.won_at IS NOT NULL
      OR pc.name ILIKE '%venda%'
      OR pc.name ILIKE '%ganho%'
    )
)
SELECT
  (SELECT total_leads FROM leads_coorte) AS total_leads_coorte,
  (SELECT count(*) FROM m) AS reunioes_marcadas,
  (SELECT count(*) FROM m WHERE status = 'done') AS reunioes_feitas,
  (SELECT count(*) FROM m WHERE status = 'no_show') AS reunioes_no_show,
  (SELECT vendas FROM sales) AS vendas,
  round(
    100.0 * (SELECT count(*) FROM m) / nullif((SELECT total_leads FROM leads_coorte), 0),
    1
  ) AS taxa_agendamento_pct,
  round(
    100.0 * (SELECT count(*) FROM m WHERE status = 'no_show') / nullif((SELECT count(*) FROM m), 0),
    1
  ) AS taxa_no_show_pct,
  round(
    100.0 * (SELECT count(*) FROM m WHERE status = 'done') / nullif((SELECT count(*) FROM m), 0),
    1
  ) AS taxa_comparecimento_pct,
  round(
    100.0 * (SELECT vendas FROM sales) / nullif((SELECT count(*) FROM m WHERE status = 'done'), 0),
    1
  ) AS taxa_conversao_pct;
