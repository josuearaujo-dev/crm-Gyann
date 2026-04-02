-- Seed Data for CRM
-- This script populates the database with fake data for testing

-- First, let's get the pipeline column IDs
DO $$
DECLARE
  col_novo UUID;
  col_contato UUID;
  col_proposta UUID;
  col_negociacao UUID;
  col_ganho UUID;
  col_perdido UUID;
  src_meta UUID;
  src_site UUID;
  src_manual UUID;
  tag_quente UUID;
  tag_frio UUID;
  tag_vip UUID;
  tag_urgente UUID;
  tag_retornar UUID;
  lead1 UUID;
  lead2 UUID;
  lead3 UUID;
  lead4 UUID;
  lead5 UUID;
  lead6 UUID;
  lead7 UUID;
  lead8 UUID;
  lead9 UUID;
  lead10 UUID;
  lead11 UUID;
  lead12 UUID;
BEGIN
  -- Get pipeline column IDs
  SELECT id INTO col_novo FROM public.pipeline_columns WHERE name = 'Novo Lead' LIMIT 1;
  SELECT id INTO col_contato FROM public.pipeline_columns WHERE name = 'Contato Feito' LIMIT 1;
  SELECT id INTO col_proposta FROM public.pipeline_columns WHERE name = 'Proposta Enviada' LIMIT 1;
  SELECT id INTO col_negociacao FROM public.pipeline_columns WHERE name = 'Negociação' LIMIT 1;
  SELECT id INTO col_ganho FROM public.pipeline_columns WHERE name = 'Fechado Ganho' LIMIT 1;
  SELECT id INTO col_perdido FROM public.pipeline_columns WHERE name = 'Fechado Perdido' LIMIT 1;

  -- Insert lead sources
  INSERT INTO public.lead_sources (id, name, type, webhook_key, is_active) VALUES
    (gen_random_uuid(), 'Meta Ads - Campanha Verao', 'meta', NULL, true)
  RETURNING id INTO src_meta;
  
  INSERT INTO public.lead_sources (id, name, type, webhook_key, is_active) VALUES
    (gen_random_uuid(), 'Formulario Site', 'webhook', 'wh_' || encode(gen_random_bytes(16), 'hex'), true)
  RETURNING id INTO src_site;
  
  INSERT INTO public.lead_sources (id, name, type, webhook_key, is_active) VALUES
    (gen_random_uuid(), 'Cadastro Manual', 'manual', NULL, true)
  RETURNING id INTO src_manual;

  -- Insert tags
  INSERT INTO public.tags (id, name, color) VALUES
    (gen_random_uuid(), 'Lead Quente', '#EF4444')
  RETURNING id INTO tag_quente;
  
  INSERT INTO public.tags (id, name, color) VALUES
    (gen_random_uuid(), 'Lead Frio', '#3B82F6')
  RETURNING id INTO tag_frio;
  
  INSERT INTO public.tags (id, name, color) VALUES
    (gen_random_uuid(), 'VIP', '#F59E0B')
  RETURNING id INTO tag_vip;
  
  INSERT INTO public.tags (id, name, color) VALUES
    (gen_random_uuid(), 'Urgente', '#DC2626')
  RETURNING id INTO tag_urgente;
  
  INSERT INTO public.tags (id, name, color) VALUES
    (gen_random_uuid(), 'Retornar Contato', '#8B5CF6')
  RETURNING id INTO tag_retornar;

  -- Insert leads - Novos Leads
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Maria Silva', 'maria.silva@email.com', '(11) 99999-1234', 'Tech Solutions', src_meta, col_novo, 0, '{"interesse": "Plano Premium", "campanha": "verao2024"}', NOW() - INTERVAL '2 hours')
  RETURNING id INTO lead1;
  
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Joao Santos', 'joao.santos@empresa.com.br', '(21) 98888-5678', 'Comercio Digital', src_site, col_novo, 1, '{"formulario": "contato", "pagina": "/produtos"}', NOW() - INTERVAL '5 hours')
  RETURNING id INTO lead2;
  
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Ana Oliveira', 'ana.oliveira@startup.io', '(31) 97777-9012', 'Startup XYZ', src_meta, col_novo, 2, '{"interesse": "Consultoria", "orcamento": "10k-50k"}', NOW() - INTERVAL '1 day')
  RETURNING id INTO lead3;

  -- Insert leads - Contato Feito
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Carlos Ferreira', 'carlos@ferreiragroup.com', '(41) 96666-3456', 'Ferreira Group', src_manual, col_contato, 0, '{"notas": "Interessado em parceria"}', NOW() - INTERVAL '3 days')
  RETURNING id INTO lead4;
  
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Patricia Costa', 'patricia.costa@industria.com', '(51) 95555-7890', 'Industria Costa', src_site, col_contato, 1, '{"setor": "manufatura", "funcionarios": "100-500"}', NOW() - INTERVAL '4 days')
  RETURNING id INTO lead5;

  -- Insert leads - Proposta Enviada
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Roberto Lima', 'roberto@limatech.com.br', '(61) 94444-1234', 'Lima Tech', src_meta, col_proposta, 0, '{"proposta": "PRO-2024-001", "valor": "R$ 25.000"}', NOW() - INTERVAL '1 week')
  RETURNING id INTO lead6;
  
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Fernanda Alves', 'fernanda@alvesconsulting.com', '(71) 93333-5678', 'Alves Consulting', src_site, col_proposta, 1, '{"proposta": "PRO-2024-002", "valor": "R$ 45.000"}', NOW() - INTERVAL '10 days')
  RETURNING id INTO lead7;

  -- Insert leads - Negociacao
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Marcos Pereira', 'marcos@bigcorp.com.br', '(81) 92222-9012', 'Big Corp SA', src_manual, col_negociacao, 0, '{"desconto_solicitado": "15%", "prazo": "30 dias"}', NOW() - INTERVAL '2 weeks')
  RETURNING id INTO lead8;

  -- Insert leads - Fechado Ganho
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Lucia Mendes', 'lucia@mendesgroup.com', '(91) 91111-3456', 'Mendes Group', src_meta, col_ganho, 0, '{"contrato": "CTR-2024-001", "valor_final": "R$ 80.000"}', NOW() - INTERVAL '3 weeks')
  RETURNING id INTO lead9;
  
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Ricardo Souza', 'ricardo@souzainvest.com', '(85) 90000-7890', 'Souza Investimentos', src_site, col_ganho, 1, '{"contrato": "CTR-2024-002", "valor_final": "R$ 120.000"}', NOW() - INTERVAL '1 month')
  RETURNING id INTO lead10;

  -- Insert leads - Fechado Perdido
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Amanda Torres', 'amanda@torres.net', '(27) 99888-1111', 'Torres Networks', src_meta, col_perdido, 0, '{"motivo_perda": "Orcamento acima do esperado"}', NOW() - INTERVAL '2 weeks')
  RETURNING id INTO lead11;
  
  INSERT INTO public.leads (id, name, email, phone, company, source_id, column_id, position, metadata, created_at) VALUES
    (gen_random_uuid(), 'Bruno Cardoso', 'bruno@cardoso.ind.br', '(47) 99777-2222', 'Cardoso Industria', src_site, col_perdido, 1, '{"motivo_perda": "Escolheu concorrente"}', NOW() - INTERVAL '3 weeks')
  RETURNING id INTO lead12;

  -- Insert lead notes
  INSERT INTO public.lead_notes (lead_id, content, created_at) VALUES
    (lead1, 'Lead entrou pelo anuncio do Instagram. Demonstrou muito interesse no plano premium.', NOW() - INTERVAL '1 hour'),
    (lead1, 'Enviado email de boas vindas com apresentacao da empresa.', NOW() - INTERVAL '30 minutes'),
    (lead4, 'Primeiro contato realizado por telefone. Cliente pediu mais informacoes sobre integracao.', NOW() - INTERVAL '2 days'),
    (lead4, 'Agendada reuniao online para proxima semana.', NOW() - INTERVAL '1 day'),
    (lead6, 'Proposta enviada conforme conversado. Aguardando retorno.', NOW() - INTERVAL '5 days'),
    (lead8, 'Cliente solicitou desconto de 15%. Vou verificar com a diretoria.', NOW() - INTERVAL '1 week'),
    (lead8, 'Desconto aprovado! Aguardando assinatura do contrato.', NOW() - INTERVAL '3 days'),
    (lead9, 'GANHO! Contrato assinado. Iniciar onboarding na proxima semana.', NOW() - INTERVAL '2 weeks'),
    (lead11, 'Infelizmente o cliente achou o valor muito alto. Tentar novamente em 6 meses.', NOW() - INTERVAL '10 days');

  -- Insert tasks (para hoje e proximos dias)
  INSERT INTO public.tasks (lead_id, title, description, due_date, completed, created_at) VALUES
    (lead1, 'Ligar para Maria Silva', 'Fazer follow-up do interesse demonstrado no plano premium', NOW() + INTERVAL '2 hours', false, NOW()),
    (lead2, 'Enviar catalogo de produtos', 'Joao pediu mais informacoes sobre a linha de produtos', NOW() + INTERVAL '4 hours', false, NOW()),
    (lead3, 'Agendar call de apresentacao', 'Ana quer conhecer melhor nossos servicos de consultoria', NOW() + INTERVAL '1 day', false, NOW()),
    (lead4, 'Preparar apresentacao', 'Reuniao online agendada para amanha', NOW() + INTERVAL '1 day', false, NOW() - INTERVAL '1 day'),
    (lead5, 'Enviar proposta comercial', 'Patricia solicitou orcamento detalhado', NOW() + INTERVAL '2 days', false, NOW()),
    (lead6, 'Follow-up da proposta', 'Verificar se Roberto recebeu e tem duvidas', NOW(), false, NOW() - INTERVAL '3 days'),
    (lead8, 'Enviar contrato revisado', 'Com o desconto aprovado de 15%', NOW() - INTERVAL '1 day', true, NOW() - INTERVAL '5 days'),
    (lead9, 'Iniciar onboarding', 'Agendar primeira reuniao de kick-off', NOW() - INTERVAL '1 week', true, NOW() - INTERVAL '2 weeks');

  -- Insert lead tags
  INSERT INTO public.lead_tags (lead_id, tag_id) VALUES
    (lead1, tag_quente),
    (lead1, tag_vip),
    (lead3, tag_quente),
    (lead4, tag_retornar),
    (lead6, tag_urgente),
    (lead8, tag_vip),
    (lead8, tag_quente),
    (lead9, tag_vip),
    (lead10, tag_vip),
    (lead11, tag_frio),
    (lead12, tag_frio);

END $$;
