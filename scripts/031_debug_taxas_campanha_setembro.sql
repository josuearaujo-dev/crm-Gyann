-- Verifica as 6 taxas (%) do relatório
-- Filtro alinhado à tela: Formulario-BR + Campanha SETEMBRO (2026-09-01 a 2026-09-11)
-- Rode no SQL Editor do Supabase e compare com os cards.

WITH cohort AS (
  SELECT
    l.id,
    l.column_id,
    l.won_at,
    EXISTS (
      SELECT 1
      FROM lead_tags lt
      JOIN tags t ON t.id = lt.tag_id
      WHERE lt.lead_id = l.id
        AND upper(t.name) LIKE '%QUAL_QUALIFICADO%'
        AND upper(t.name) NOT LIKE '%NAO_QUALIFICADO%'
    ) AS is_mql
  FROM leads l
  JOIN lead_sources ls ON ls.id = l.source_id
  WHERE ls.name ILIKE '%Formulario-BR%'
    AND l.created_at >= '2026-09-01 00:00:00+00'
    AND l.created_at <  '2026-09-12 00:00:00+00'
    AND coalesce(l.excluded_from_reports, false) = false
    AND coalesce(l.is_lost, false) = false
),
won_col AS (
  SELECT id
  FROM pipeline_columns
  WHERE name ILIKE '%venda%'
     OR name ILIKE '%ganho%'
     OR name ILIKE '%won%'
  ORDER BY position
  LIMIT 1
),
meeting_flags AS (
  SELECT
    c.id AS lead_id,
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.lead_id = c.id
        AND coalesce(m.status, '') <> 'cancelled'
    ) AS has_marked,
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.lead_id = c.id
        AND m.status = 'done'
    ) AS has_held,
    EXISTS (
      SELECT 1
      FROM meetings m
      WHERE m.lead_id = c.id
        AND m.status = 'no_show'
    ) AS has_no_show
  FROM cohort c
),
sales AS (
  SELECT c.id
  FROM cohort c
  LEFT JOIN won_col w ON true
  LEFT JOIN pipeline_columns pc ON pc.id = c.column_id
  WHERE c.won_at IS NOT NULL
     OR c.column_id = w.id
     OR pc.name ILIKE '%venda%'
     OR pc.name ILIKE '%ganho%'
),
base AS (
  SELECT
    (SELECT count(*) FROM cohort) AS total_leads,
    (SELECT count(*) FROM cohort WHERE is_mql) AS mql_count,
    (SELECT count(*) FROM meeting_flags WHERE has_marked) AS leads_com_reuniao_marcada,
    (SELECT count(*) FROM meeting_flags WHERE has_held) AS leads_com_reuniao_realizada,
    (SELECT count(*) FROM meeting_flags WHERE has_no_show) AS leads_no_show,
    (SELECT count(*) FROM sales) AS vendas,
    (
      SELECT count(*)
      FROM sales s
      JOIN meeting_flags mf ON mf.lead_id = s.id
      WHERE mf.has_marked
    ) AS vendas_com_reuniao_marcada
)
SELECT
  total_leads,
  mql_count,
  leads_com_reuniao_marcada,
  leads_com_reuniao_realizada,
  leads_no_show,
  vendas,
  vendas_com_reuniao_marcada,

  -- Taxas (mesma lógica do CRM)
  round(100.0 * leads_com_reuniao_marcada / nullif(total_leads, 0), 1)
    AS taxa_agendamento_pct,
  round(100.0 * mql_count / nullif(total_leads, 0), 1)
    AS taxa_mql_pct,
  round(100.0 * leads_no_show / nullif(leads_com_reuniao_marcada, 0), 1)
    AS taxa_no_show_pct,
  round(100.0 * leads_com_reuniao_realizada / nullif(leads_com_reuniao_marcada, 0), 1)
    AS taxa_comparecimento_pct,
  round(100.0 * vendas_com_reuniao_marcada / nullif(leads_com_reuniao_marcada, 0), 1)
    AS taxa_conversao_pct,
  round(100.0 * vendas / nullif(total_leads, 0), 1)
    AS taxa_inrate_pct
FROM base;

-- Esperado na tela (Formulario-BR / SETEMBRO), se bater:
-- Agendamento 16.0 | MQL 8.0 | No-show 0 | Comparecimento 100 | Conversão 75.0 | Inrate 12.0
-- Contagens típicas: 25 leads, 2 MQL, 4 com reunião, 3 vendas
