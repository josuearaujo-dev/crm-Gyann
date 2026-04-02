-- Create US States table
CREATE TABLE IF NOT EXISTS public.us_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.us_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "us_states_select_all" ON public.us_states FOR SELECT USING (true);

-- Insert all US states
INSERT INTO public.us_states (name, abbreviation) VALUES
  ('Alabama', 'AL'),
  ('Alasca', 'AK'),
  ('Arizona', 'AZ'),
  ('Arkansas', 'AR'),
  ('Califórnia', 'CA'),
  ('Carolina do Norte', 'NC'),
  ('Carolina do Sul', 'SC'),
  ('Colorado', 'CO'),
  ('Connecticut', 'CT'),
  ('Dakota do Norte', 'ND'),
  ('Dakota do Sul', 'SD'),
  ('Delaware', 'DE'),
  ('Flórida', 'FL'),
  ('Geórgia', 'GA'),
  ('Havai', 'HI'),
  ('Idaho', 'ID'),
  ('Illinois', 'IL'),
  ('Indiana', 'IN'),
  ('Iowa', 'IA'),
  ('Kansas', 'KS'),
  ('Kentucky', 'KY'),
  ('Louisiana', 'LA'),
  ('Maine', 'ME'),
  ('Maryland', 'MD'),
  ('Massachusetts', 'MA'),
  ('Michigan', 'MI'),
  ('Minnesota', 'MN'),
  ('Mississippi', 'MS'),
  ('Missouri', 'MO'),
  ('Montana', 'MT'),
  ('Nebraska', 'NE'),
  ('Nevada', 'NV'),
  ('New Hampshire', 'NH'),
  ('Nova Jérsia', 'NJ'),
  ('Nova Iorque', 'NY'),
  ('Novo México', 'NM'),
  ('Ohio', 'OH'),
  ('Oklahoma', 'OK'),
  ('Oregon', 'OR'),
  ('Pensilvânia', 'PA'),
  ('Rhode Island', 'RI'),
  ('Tennessee', 'TN'),
  ('Texas', 'TX'),
  ('Utah', 'UT'),
  ('Vermont', 'VT'),
  ('Virgínia', 'VA'),
  ('Virgínia Ocidental', 'WV'),
  ('Washington', 'WA'),
  ('Wisconsin', 'WI'),
  ('Wyoming', 'WY')
ON CONFLICT DO NOTHING;

-- Add state_id to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES public.us_states(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_state_id ON public.leads(state_id);

-- Comment on column
COMMENT ON COLUMN public.leads.state_id IS 'US State where the lead is located';
