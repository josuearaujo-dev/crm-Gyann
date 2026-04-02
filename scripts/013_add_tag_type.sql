-- Add type column to tags table
ALTER TABLE tags ADD COLUMN IF NOT EXISTS type TEXT;

-- Create tag types
CREATE TYPE tag_type AS ENUM ('QUALIFICACAO', 'TEMPERATURA', 'TENTATIVA_CONTATO', 'FOLLOW_UP');

-- Update column to use enum (if you want strict typing)
-- ALTER TABLE tags ALTER COLUMN type TYPE tag_type USING type::tag_type;

-- Or keep as text for flexibility
-- Add check constraint instead
ALTER TABLE tags ADD CONSTRAINT tags_type_check 
  CHECK (type IN ('QUALIFICACAO', 'TEMPERATURA', 'TENTATIVA_CONTATO', 'FOLLOW_UP'));

-- Insert predefined tags

-- QUALIFICAÇÃO
INSERT INTO tags (id, name, color, type) VALUES
  (gen_random_uuid(), 'QUAL_QUALIFICADO', '#10b981', 'QUALIFICACAO'),
  (gen_random_uuid(), 'QUAL_NAO_QUALIFICADO', '#ef4444', 'QUALIFICACAO')
ON CONFLICT DO NOTHING;

-- TEMPERATURA
INSERT INTO tags (id, name, color, type) VALUES
  (gen_random_uuid(), 'TEMP_HOT_LEAD', '#f59e0b', 'TEMPERATURA'),
  (gen_random_uuid(), 'TEMP_COLD_LEAD', '#3b82f6', 'TEMPERATURA')
ON CONFLICT DO NOTHING;

-- TENTATIVAS DE PRIMEIRO CONTATO
INSERT INTO tags (id, name, color, type) VALUES
  (gen_random_uuid(), 'CONT_TENTATIVA_1', '#8b5cf6', 'TENTATIVA_CONTATO'),
  (gen_random_uuid(), 'CONT_TENTATIVA_2', '#8b5cf6', 'TENTATIVA_CONTATO'),
  (gen_random_uuid(), 'CONT_TENTATIVA_3', '#8b5cf6', 'TENTATIVA_CONTATO'),
  (gen_random_uuid(), 'CONT_TENTATIVA_4', '#8b5cf6', 'TENTATIVA_CONTATO'),
  (gen_random_uuid(), 'CONT_TENTATIVA_5', '#8b5cf6', 'TENTATIVA_CONTATO')
ON CONFLICT DO NOTHING;

-- TENTATIVAS DE FOLLOW UP
INSERT INTO tags (id, name, color, type) VALUES
  (gen_random_uuid(), 'FU_TENTATIVA_1', '#ec4899', 'FOLLOW_UP'),
  (gen_random_uuid(), 'FU_TENTATIVA_2', '#ec4899', 'FOLLOW_UP'),
  (gen_random_uuid(), 'FU_TENTATIVA_3', '#ec4899', 'FOLLOW_UP'),
  (gen_random_uuid(), 'FU_TENTATIVA_4', '#ec4899', 'FOLLOW_UP'),
  (gen_random_uuid(), 'FU_TENTATIVA_5', '#ec4899', 'FOLLOW_UP')
ON CONFLICT DO NOTHING;
