-- Script de correção: Configurar Pipeline sem deletar leads
-- Remove a constraint temporariamente, recria as colunas, e atualiza os leads

-- 1. Remove temporariamente a constraint foreign key
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_column_id_fkey;

-- 2. Limpa as colunas antigas (mas leads ainda existem)
DELETE FROM public.pipeline_columns;

-- 3. Cria as colunas na ordem correta com IDs conhecidos
INSERT INTO public.pipeline_columns (id, name, color, position) VALUES
  (gen_random_uuid(), 'Novo Lead', '#3B82F6', 0),
  (gen_random_uuid(), 'Tentando Contato', '#F59E0B', 1),
  (gen_random_uuid(), 'Reunião Marcada', '#8B5CF6', 2),
  (gen_random_uuid(), 'Reunião Feita', '#06B6D4', 3),
  (gen_random_uuid(), 'Follow Up', '#EC4899', 4),
  (gen_random_uuid(), 'Contrato Enviado', '#10B981', 5),
  (gen_random_uuid(), 'Recuperar Venda', '#F97316', 6),
  (gen_random_uuid(), 'Venda Feita', '#22C55E', 7);

-- 4. Atualiza todos os leads órfãos para a primeira coluna (Novo Lead)
UPDATE public.leads 
SET column_id = (SELECT id FROM public.pipeline_columns WHERE name = 'Novo Lead' LIMIT 1)
WHERE column_id IS NULL OR column_id NOT IN (SELECT id FROM public.pipeline_columns);

-- 5. Restaura a constraint foreign key
ALTER TABLE public.leads 
ADD CONSTRAINT leads_column_id_fkey 
FOREIGN KEY (column_id) 
REFERENCES public.pipeline_columns(id) 
ON DELETE SET NULL;

-- 6. Remove tags antigas e cria as novas (tags não afetam leads diretamente)
DELETE FROM public.lead_tags;
DELETE FROM public.tags;

INSERT INTO public.tags (name, color) VALUES
  -- QUALIFICAÇÃO (PREFIXO: QUAL_)
  ('QUAL_QUALIFICADO', '#10B981'),
  ('QUAL_NAO_QUALIFICADO', '#EF4444'),
  -- TEMPERATURA (PREFIXO: TEMP_)
  ('TEMP_HOT_LEAD', '#DC2626'),
  ('TEMP_COLD_LEAD', '#3B82F6'),
  -- TENTATIVAS DE PRIMEIRO CONTATO (PREFIXO: CONT_)
  ('CONT_TENTATIVA_1', '#6366F1'),
  ('CONT_TENTATIVA_2', '#8B5CF6'),
  ('CONT_TENTATIVA_3', '#A855F7'),
  ('CONT_TENTATIVA_4', '#C026D3'),
  ('CONT_TENTATIVA_5', '#D946EF'),
  -- TENTATIVAS DE FOLLOW UP (PREFIXO: FU_)
  ('FU_TENTATIVA_1', '#14B8A6'),
  ('FU_TENTATIVA_2', '#06B6D4'),
  ('FU_TENTATIVA_3', '#0EA5E9'),
  ('FU_TENTATIVA_4', '#3B82F6'),
  ('FU_TENTATIVA_5', '#6366F1');
