-- Script para configurar Pipeline e Tags padrão do sistema
-- Alteração 1: Pipeline fixo e Tags padronizadas com prefixos

-- ========================================
-- 1. PIPELINE (ETAPAS / COLUNAS) - ORDEM FIXA
-- ========================================

-- Remove colunas antigas
DELETE FROM public.pipeline_columns;

-- Insere as colunas na ordem correta
INSERT INTO public.pipeline_columns (name, color, position) VALUES
  ('Novo Lead', '#3B82F6', 0),
  ('Tentando Contato', '#F59E0B', 1),
  ('Reunião Marcada', '#8B5CF6', 2),
  ('Reunião Feita', '#06B6D4', 3),
  ('Follow Up', '#EC4899', 4),
  ('Contrato Enviado', '#10B981', 5),
  ('Recuperar Venda', '#F97316', 6),
  ('Venda Feita', '#22C55E', 7);

-- ========================================
-- 2. TAGS PADRÃO COM PREFIXOS
-- ========================================

-- Remove tags antigas
DELETE FROM public.tags;

-- 2.1 QUALIFICAÇÃO (PREFIXO: QUAL_)
INSERT INTO public.tags (name, color) VALUES
  ('QUAL_QUALIFICADO', '#10B981'),
  ('QUAL_NAO_QUALIFICADO', '#EF4444');

-- 2.2 TEMPERATURA (PREFIXO: TEMP_)
INSERT INTO public.tags (name, color) VALUES
  ('TEMP_HOT_LEAD', '#DC2626'),
  ('TEMP_COLD_LEAD', '#3B82F6');

-- 2.3 TENTATIVAS DE PRIMEIRO CONTATO (PREFIXO: CONT_)
INSERT INTO public.tags (name, color) VALUES
  ('CONT_TENTATIVA_1', '#6366F1'),
  ('CONT_TENTATIVA_2', '#8B5CF6'),
  ('CONT_TENTATIVA_3', '#A855F7'),
  ('CONT_TENTATIVA_4', '#C026D3'),
  ('CONT_TENTATIVA_5', '#D946EF');

-- 2.4 TENTATIVAS DE FOLLOW UP (PREFIXO: FU_)
INSERT INTO public.tags (name, color) VALUES
  ('FU_TENTATIVA_1', '#14B8A6'),
  ('FU_TENTATIVA_2', '#06B6D4'),
  ('FU_TENTATIVA_3', '#0EA5E9'),
  ('FU_TENTATIVA_4', '#3B82F6'),
  ('FU_TENTATIVA_5', '#6366F1');

-- Comentários explicativos
COMMENT ON TABLE public.pipeline_columns IS 'Colunas fixas do funil de vendas - ordem não deve ser alterada';
COMMENT ON TABLE public.tags IS 'Tags padronizadas com prefixos: QUAL_ (qualificação), TEMP_ (temperatura), CONT_ (contato), FU_ (follow-up)';
