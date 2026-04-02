-- Adicionar tags organizadas por tipo
-- Verificar se já existe a coluna type (já existe segundo o schema)

-- Limpar tags antigas se necessário
-- DELETE FROM lead_tags;
-- DELETE FROM task_tags;
-- DELETE FROM tags;

-- Inserir tags de QUALIFICAÇÃO
INSERT INTO tags (name, color, type, created_at) VALUES
('QUAL_QUALIFICADO', '#10b981', 'QUALIFICACAO', NOW()),
('QUAL_NAO_QUALIFICADO', '#ef4444', 'QUALIFICACAO', NOW())
ON CONFLICT DO NOTHING;

-- Inserir tags de TEMPERATURA
INSERT INTO tags (name, color, type, created_at) VALUES
('TEMP_HOT_LEAD', '#f97316', 'TEMPERATURA', NOW()),
('TEMP_COLD_LEAD', '#3b82f6', 'TEMPERATURA', NOW())
ON CONFLICT DO NOTHING;

-- Inserir tags de TENTATIVAS DE PRIMEIRO CONTATO
INSERT INTO tags (name, color, type, created_at) VALUES
('CONT_TENTATIVA_1', '#8b5cf6', 'TENTATIVA_CONTATO', NOW()),
('CONT_TENTATIVA_2', '#8b5cf6', 'TENTATIVA_CONTATO', NOW()),
('CONT_TENTATIVA_3', '#8b5cf6', 'TENTATIVA_CONTATO', NOW()),
('CONT_TENTATIVA_4', '#8b5cf6', 'TENTATIVA_CONTATO', NOW()),
('CONT_TENTATIVA_5', '#8b5cf6', 'TENTATIVA_CONTATO', NOW())
ON CONFLICT DO NOTHING;

-- Inserir tags de TENTATIVAS DE FOLLOW UP
INSERT INTO tags (name, color, type, created_at) VALUES
('FU_TENTATIVA_1', '#ec4899', 'FOLLOW_UP', NOW()),
('FU_TENTATIVA_2', '#ec4899', 'FOLLOW_UP', NOW()),
('FU_TENTATIVA_3', '#ec4899', 'FOLLOW_UP', NOW()),
('FU_TENTATIVA_4', '#ec4899', 'FOLLOW_UP', NOW()),
('FU_TENTATIVA_5', '#ec4899', 'FOLLOW_UP', NOW())
ON CONFLICT DO NOTHING;
