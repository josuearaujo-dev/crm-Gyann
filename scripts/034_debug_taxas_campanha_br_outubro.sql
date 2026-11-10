-- Investigação alinhada à tela:
-- Formulário: Formulario-BR | Datas: 01/10/2026 → 09/11/2026
-- Tela: 23 leads · 9 marcadas · 5 feitas · 4 no-show
-- Cliente: 10 marcadas · 6 feitas · 4 no-show · 4 vendas → 40% / 66%
--
-- Rode as queries em ordem no SQL Editor.

-- 0) Fonte Formulario-BR + campanhas no período
SELECT id, name
FROM lead_sources
WHERE name ILIKE '%Formulario-BR%' OR name ILIKE '%BR%'
ORDER BY name;

SELECT id, name, start_date, end_date, budget
FROM campaigns
WHERE start_date <= '2026-11-09'
  AND end_date   >= '2026-10-01'
ORDER BY start_date;

-- ============================================================
-- Janela da tela: 01/10/2026 – 09/11/2026 (inclusive)
-- p_end exclusivo = 10/11
-- ============================================================

-- 1) MODELO CRM (coorte = lead CRIADO na janela + Formulario-BR)
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
),
cohort AS (
  SELECT l.id, l.name, l.created_at, l.source_id, l.column_id, l.won_at
  FROM leads l
  CROSS JOIN params p
  JOIN fonte f ON f.id = l.source_id
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND l.created_at >= p.p_start
    AND l.created_at <  p.p_end
),
meetings_crm AS (
  SELECT m.*
  FROM meetings m
  JOIN cohort c ON c.id = m.lead_id
  WHERE coalesce(m.status, '') <> 'cancelled'
),
sales_crm AS (
  SELECT c.id
  FROM cohort c
  LEFT JOIN pipeline_columns pc ON pc.id = c.column_id
  WHERE c.won_at IS NOT NULL
     OR pc.name ILIKE '%venda%'
     OR pc.name ILIKE '%ganho%'
)
SELECT
  'MODELO CRM (coorte created_at + Formulario-BR)' AS modelo,
  (SELECT count(*) FROM cohort) AS total_leads,
  (SELECT count(*) FROM meetings_crm) AS reunioes_marcadas,
  (SELECT count(*) FROM meetings_crm WHERE status = 'done') AS reunioes_feitas,
  (SELECT count(*) FROM meetings_crm WHERE status = 'no_show') AS reunioes_no_show,
  (SELECT count(*) FROM meetings_crm WHERE status = 'scheduled') AS reunioes_ainda_agendadas,
  (SELECT count(*) FROM sales_crm) AS vendas,
  round(100.0 * (SELECT count(*) FROM meetings_crm)
    / nullif((SELECT count(*) FROM cohort), 0), 1) AS taxa_agendamento_pct,
  round(100.0 * (SELECT count(*) FROM meetings_crm WHERE status = 'no_show')
    / nullif((SELECT count(*) FROM meetings_crm), 0), 1) AS taxa_no_show_pct,
  round(100.0 * (SELECT count(*) FROM sales_crm)
    / nullif((SELECT count(*) FROM meetings_crm WHERE status = 'done'), 0), 1)
    AS taxa_conversao_pct;

-- 2) MODELO CLIENTE (reuniões com scheduled_at na janela + Formulario-BR)
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
),
meetings_janela AS (
  SELECT m.*, l.name AS lead_name, l.created_at AS lead_created_at
  FROM meetings m
  JOIN leads l ON l.id = m.lead_id
  JOIN fonte f ON f.id = l.source_id
  CROSS JOIN params p
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND coalesce(m.status, '') <> 'cancelled'
    AND m.scheduled_at >= p.p_start
    AND m.scheduled_at <  p.p_end
),
sales_coorte AS (
  SELECT count(*) AS vendas
  FROM leads l
  JOIN fonte f ON f.id = l.source_id
  CROSS JOIN params p
  LEFT JOIN pipeline_columns pc ON pc.id = l.column_id
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND l.created_at >= p.p_start
    AND l.created_at <  p.p_end
    AND (
      l.won_at IS NOT NULL
      OR pc.name ILIKE '%venda%'
      OR pc.name ILIKE '%ganho%'
    )
)
SELECT
  'MODELO CLIENTE (scheduled_at na janela + Formulario-BR)' AS modelo,
  (SELECT count(*) FROM meetings_janela) AS reunioes_marcadas,
  (SELECT count(*) FROM meetings_janela WHERE status = 'done') AS reunioes_feitas,
  (SELECT count(*) FROM meetings_janela WHERE status = 'no_show') AS reunioes_no_show,
  (SELECT count(*) FROM meetings_janela WHERE status = 'scheduled') AS reunioes_ainda_agendadas,
  (SELECT vendas FROM sales_coorte) AS vendas_coorte,
  round(100.0 * (SELECT count(*) FROM meetings_janela WHERE status = 'no_show')
    / nullif((SELECT count(*) FROM meetings_janela), 0), 1) AS taxa_no_show_pct,
  round(100.0 * (SELECT vendas FROM sales_coorte)
    / nullif((SELECT count(*) FROM meetings_janela WHERE status = 'done'), 0), 1)
    AS taxa_conversao_pct;

-- 3) LISTA CRM: as 9 da tela (lead criado na janela, qualquer scheduled_at)
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
)
SELECT
  m.scheduled_at,
  m.status,
  l.name AS lead_name,
  l.created_at::date AS lead_criado_em,
  CASE
    WHEN m.scheduled_at >= p.p_start AND m.scheduled_at < p.p_end
      THEN 'agendada DENTRO da janela 01/10–09/11'
    WHEN m.scheduled_at >= p.p_end
      THEN 'agendada DEPOIS de 09/11 (entra no CRM)'
    WHEN m.scheduled_at < p.p_start
      THEN 'agendada ANTES de 01/10 (entra no CRM)'
    ELSE 'sem scheduled_at'
  END AS quando_na_agenda
FROM meetings m
JOIN leads l ON l.id = m.lead_id
JOIN fonte f ON f.id = l.source_id
CROSS JOIN params p
WHERE coalesce(l.excluded_from_reports, false) = false
  AND coalesce(l.is_lost, false) = false
  AND coalesce(m.status, '') <> 'cancelled'
  AND l.created_at >= p.p_start
  AND l.created_at <  p.p_end
ORDER BY m.scheduled_at NULLS LAST;

-- 4) LISTA AGENDA: reuniões marcadas na janela + se o lead entra no CRM
--    → aqui deve aparecer a 10ª que o cliente conta e o CRM não
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
)
SELECT
  m.scheduled_at,
  m.status,
  l.name AS lead_name,
  l.created_at::date AS lead_criado_em,
  CASE
    WHEN l.created_at >= p.p_start AND l.created_at < p.p_end
      THEN 'ENTRA no CRM (coorte)'
    ELSE 'FORA — lead criado fora de 01/10–09/11'
  END AS motivo
FROM meetings m
JOIN leads l ON l.id = m.lead_id
JOIN fonte f ON f.id = l.source_id
CROSS JOIN params p
WHERE coalesce(l.excluded_from_reports, false) = false
  AND coalesce(l.is_lost, false) = false
  AND coalesce(m.status, '') <> 'cancelled'
  AND m.scheduled_at >= p.p_start
  AND m.scheduled_at <  p.p_end
ORDER BY m.scheduled_at;

-- 5) Mesma agenda SEM filtrar fonte (se a 10ª for USA / outra fonte)
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
)
SELECT
  m.scheduled_at,
  m.status,
  l.name AS lead_name,
  ls.name AS fonte,
  l.created_at::date AS lead_criado_em
FROM meetings m
JOIN leads l ON l.id = m.lead_id
LEFT JOIN lead_sources ls ON ls.id = l.source_id
CROSS JOIN params p
WHERE coalesce(l.excluded_from_reports, false) = false
  AND coalesce(l.is_lost, false) = false
  AND coalesce(m.status, '') <> 'cancelled'
  AND m.scheduled_at >= p.p_start
  AND m.scheduled_at <  p.p_end
ORDER BY m.scheduled_at;
