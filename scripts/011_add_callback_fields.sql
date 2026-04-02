-- Add callback/scheduled task fields to tasks table

-- Add type field to distinguish task types (callback, manual, etc)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'manual' CHECK (type IN ('manual', 'callback'));

-- Add scheduled_at for when task should be executed
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add status field for task workflow (scheduled, overdue, done)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'overdue', 'done'));

-- Add note field for callback notes
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add done_at to track when task was completed
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ;

-- Create index for efficient scheduled task queries
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON public.tasks(scheduled_at) WHERE status IN ('scheduled', 'overdue');
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(type);

-- Update existing tasks to have proper status
UPDATE public.tasks 
SET status = CASE 
  WHEN completed = true THEN 'done'
  ELSE 'pending'
END
WHERE status IS NULL OR status = 'pending';

-- Set done_at for already completed tasks
UPDATE public.tasks 
SET done_at = completed_at
WHERE completed = true AND done_at IS NULL;
