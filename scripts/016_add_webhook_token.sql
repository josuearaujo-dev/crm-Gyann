-- Adicionar campo webhook_token na tabela lead_sources
ALTER TABLE lead_sources ADD COLUMN IF NOT EXISTS webhook_token TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN lead_sources.webhook_token IS 'Token de verificação para webhooks (Meta, etc)';

-- Gerar tokens aleatórios para fontes existentes que não têm token
UPDATE lead_sources 
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE webhook_token IS NULL;
