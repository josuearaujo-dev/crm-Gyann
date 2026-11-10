-- Por que Taxa de Conversão = 60% (não 80%)?
-- Tela: Formulario-BR | 01/10/2026 → 09/11/2026
-- Funil: 4 vendas · 5 leads com reunião feita
-- Taxa: vendas COM reunião done E scheduled_at <= won_at  ÷  leads com reunião feita
-- 3 ÷ 5 = 60%  → 1 venda NÃO entra
--
-- Rode as 3 queries no SQL Editor.

-- 1) As 4 vendas da coorte + se entram na taxa de conversão
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
),
cohort_sales AS (
  SELECT
    l.id,
    l.name,
    l.created_at,
    l.won_at,
    l.updated_at,
    coalesce(l.won_at, l.updated_at) AS closed_at,
    pc.name AS coluna
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
      OR pc.name ILIKE '%won%'
    )
)
SELECT
  s.name AS lead,
  s.created_at::date AS lead_criado_em,
  s.won_at,
  s.closed_at,
  s.coluna,
  (
    SELECT count(*)
    FROM meetings m
    WHERE m.lead_id = s.id
      AND m.status = 'done'
      AND coalesce(m.status, '') <> 'cancelled'
  ) AS reunioes_done,
  (
    SELECT min(m.scheduled_at)
    FROM meetings m
    WHERE m.lead_id = s.id
      AND m.status = 'done'
  ) AS primeira_reuniao_done,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.lead_id = s.id
        AND m.status = 'done'
        AND m.scheduled_at <= s.closed_at
    ) THEN 'ENTRA na taxa (3/5 → conta no numerador)'
    WHEN EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.lead_id = s.id
        AND m.status = 'done'
        AND m.scheduled_at > s.closed_at
    ) THEN 'FORA — reunião done DEPOIS do ganho (won_at)'
    WHEN EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.lead_id = s.id
        AND coalesce(m.status, '') <> 'cancelled'
    ) THEN 'FORA — tem reunião, mas nenhuma done'
    ELSE 'FORA — venda sem reunião na coorte'
  END AS motivo_conversao
FROM cohort_sales s
ORDER BY s.closed_at NULLS LAST;

-- 2) Os 5 leads com reunião realizada (denominador da taxa)
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
),
cohort AS (
  SELECT l.id, l.name, l.created_at, l.won_at, l.updated_at, l.column_id
  FROM leads l
  JOIN fonte f ON f.id = l.source_id
  CROSS JOIN params p
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND l.created_at >= p.p_start
    AND l.created_at <  p.p_end
)
SELECT DISTINCT
  c.name AS lead,
  c.created_at::date AS lead_criado_em,
  m.scheduled_at AS reuniao_done_em,
  c.won_at,
  CASE
    WHEN c.won_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM pipeline_columns pc
        WHERE pc.id = c.column_id
          AND (
            pc.name ILIKE '%venda%'
            OR pc.name ILIKE '%ganho%'
            OR pc.name ILIKE '%won%'
          )
      )
    THEN 'é venda'
    ELSE 'não vendeu'
  END AS status_venda,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM meetings m2
      WHERE m2.lead_id = c.id
        AND m2.status = 'done'
        AND m2.scheduled_at <= coalesce(c.won_at, c.updated_at)
    )
    AND (
      c.won_at IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM pipeline_columns pc
        WHERE pc.id = c.column_id
          AND (
            pc.name ILIKE '%venda%'
            OR pc.name ILIKE '%ganho%'
            OR pc.name ILIKE '%won%'
          )
      )
    )
    THEN 'conta no numerador da conversão'
    ELSE 'só no denominador (não conta como venda-da-reunião)'
  END AS na_taxa
FROM cohort c
JOIN meetings m ON m.lead_id = c.id AND m.status = 'done'
ORDER BY m.scheduled_at;

-- 3) Resumo (deve bater 60%)
WITH params AS (
  SELECT
    '2026-10-01 00:00:00+00'::timestamptz AS p_start,
    '2026-11-10 00:00:00+00'::timestamptz AS p_end
),
fonte AS (
  SELECT id FROM lead_sources WHERE name = 'Formulario-BR'
),
cohort AS (
  SELECT l.*
  FROM leads l
  JOIN fonte f ON f.id = l.source_id
  CROSS JOIN params p
  WHERE coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
    AND l.created_at >= p.p_start
    AND l.created_at <  p.p_end
),
held AS (
  SELECT DISTINCT m.lead_id
  FROM meetings m
  JOIN cohort c ON c.id = m.lead_id
  WHERE m.status = 'done'
),
sales AS (
  SELECT c.id, coalesce(c.won_at, c.updated_at) AS closed_at
  FROM cohort c
  LEFT JOIN pipeline_columns pc ON pc.id = c.column_id
  WHERE c.won_at IS NOT NULL
     OR pc.name ILIKE '%venda%'
     OR pc.name ILIKE '%ganho%'
     OR pc.name ILIKE '%won%'
),
sales_from_held AS (
  SELECT s.id
  FROM sales s
  WHERE EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.lead_id = s.id
      AND m.status = 'done'
      AND m.scheduled_at <= s.closed_at
  )
)
SELECT
  (SELECT count(*) FROM sales) AS vendas_totais,
  (SELECT count(*) FROM held) AS leads_com_reuniao_feita,
  (SELECT count(*) FROM sales_from_held) AS vendas_que_entram_na_taxa,
  round(
    100.0 * (SELECT count(*) FROM sales_from_held)
      / nullif((SELECT count(*) FROM held), 0),
    1
  ) AS taxa_conversao_pct;
