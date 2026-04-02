-- Add city and nationality fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT;

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_nationality ON public.leads(nationality) WHERE nationality IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);

-- Comment on columns
COMMENT ON COLUMN public.leads.city IS 'City of the lead';
COMMENT ON COLUMN public.leads.nationality IS 'Nationality of the lead';
