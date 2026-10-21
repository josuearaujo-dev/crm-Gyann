-- Diagnóstico das vendas da Campanha SETEMBRO + Formulario-BR
-- Rode no SQL Editor do Supabase e me mande o resultado (CSV ou print).

-- 1) Vendas da coorte (criadas no período da campanha) no Formulario-BR
SELECT
  l.id,
  l.name,
  l.email,
  l.created_at,
  l.won_at,
  l.updated_at,
  l.deal_value,
  l.mrr_value,
  l.contract_type,
  l.contract_months,
  l.payment_model,
  l.amount_received,
  l.is_lost,
  l.excluded_from_reports,
  pc.name AS coluna_pipeline,
  ls.name AS formulario_fonte,
  COALESCE(
    (
      SELECT string_agg(t.name, ', ' ORDER BY t.name)
      FROM lead_tags lt
      JOIN tags t ON t.id = lt.tag_id
      WHERE lt.lead_id = l.id
    ),
    '(sem tags)'
  ) AS tags,
  EXISTS (
    SELECT 1
    FROM lead_tags lt
    JOIN tags t ON t.id = lt.tag_id
    WHERE lt.lead_id = l.id
      AND upper(t.name) LIKE '%QUAL_QUALIFICADO%'
      AND upper(t.name) NOT LIKE '%NAO_QUALIFICADO%'
  ) AS tem_qual_qualificado,
  EXISTS (
    SELECT 1
    FROM lead_tags lt
    JOIN tags t ON t.id = lt.tag_id
    WHERE lt.lead_id = l.id
      AND (
        upper(t.name) LIKE '%NAO_QUALIFICADO%'
        OR upper(t.name) LIKE '%DESQUALIFICADO%'
      )
  ) AS tem_nao_qualificado,
  (
    SELECT count(*)
    FROM meetings m
    WHERE m.lead_id = l.id
      AND coalesce(m.status, '') <> 'cancelled'
  ) AS reunioes_marcadas,
  (
    SELECT count(*)
    FROM meetings m
    WHERE m.lead_id = l.id
      AND m.status = 'done'
  ) AS reunioes_realizadas,
  (
    SELECT count(*)
    FROM meetings m
    WHERE m.lead_id = l.id
      AND m.status = 'no_show'
  ) AS reunioes_no_show
FROM leads l
JOIN lead_sources ls ON ls.id = l.source_id
LEFT JOIN pipeline_columns pc ON pc.id = l.column_id
WHERE ls.name ILIKE '%Formulario-BR%'
  AND l.created_at >= '2026-09-01 00:00:00+00'
  AND l.created_at <  '2026-09-12 00:00:00+00'
  AND coalesce(l.excluded_from_reports, false) = false
  AND coalesce(l.is_lost, false) = false
  AND (
    pc.name ILIKE '%venda%'
    OR pc.name ILIKE '%ganho%'
    OR pc.name ILIKE '%won%'
    OR l.won_at IS NOT NULL
  )
ORDER BY l.created_at;

-- 2) Resumo rápido (totais da mesma janela/fonte)
SELECT
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
  ) AS total_leads,
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND EXISTS (
        SELECT 1
        FROM lead_tags lt
        JOIN tags t ON t.id = lt.tag_id
        WHERE lt.lead_id = l.id
          AND upper(t.name) LIKE '%QUAL_QUALIFICADO%'
          AND upper(t.name) NOT LIKE '%NAO_QUALIFICADO%'
      )
  ) AS qualificados,
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND EXISTS (
        SELECT 1
        FROM lead_tags lt
        JOIN tags t ON t.id = lt.tag_id
        WHERE lt.lead_id = l.id
          AND (
            upper(t.name) LIKE '%NAO_QUALIFICADO%'
            OR upper(t.name) LIKE '%DESQUALIFICADO%'
          )
      )
  ) AS desqualificados,
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND (
        pc.name ILIKE '%venda%'
        OR pc.name ILIKE '%ganho%'
        OR l.won_at IS NOT NULL
      )
  ) AS vendas,
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND (
        pc.name ILIKE '%venda%'
        OR pc.name ILIKE '%ganho%'
        OR l.won_at IS NOT NULL
      )
      AND l.contract_type = 'mrr'
  ) AS vendas_tipo_mrr,
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND (
        pc.name ILIKE '%venda%'
        OR pc.name ILIKE '%ganho%'
        OR l.won_at IS NOT NULL
      )
      AND l.contract_type = 'tcv'
  ) AS vendas_tipo_tcv,
  count(*) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND (
        pc.name ILIKE '%venda%'
        OR pc.name ILIKE '%ganho%'
        OR l.won_at IS NOT NULL
      )
      AND l.contract_type IS NULL
  ) AS vendas_sem_tipo_contrato,
  coalesce(sum(l.deal_value) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND (
        pc.name ILIKE '%venda%'
        OR pc.name ILIKE '%ganho%'
        OR l.won_at IS NOT NULL
      )
  ), 0) AS soma_tcv_deal_value,
  coalesce(sum(l.mrr_value) FILTER (
    WHERE coalesce(l.excluded_from_reports, false) = false
      AND coalesce(l.is_lost, false) = false
      AND (
        pc.name ILIKE '%venda%'
        OR pc.name ILIKE '%ganho%'
        OR l.won_at IS NOT NULL
      )
  ), 0) AS soma_mrr_value
FROM leads l
JOIN lead_sources ls ON ls.id = l.source_id
LEFT JOIN pipeline_columns pc ON pc.id = l.column_id
WHERE ls.name ILIKE '%Formulario-BR%'
  AND l.created_at >= '2026-09-01 00:00:00+00'
  AND l.created_at <  '2026-09-12 00:00:00+00';
