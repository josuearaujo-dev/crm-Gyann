-- Add start_time and end_time fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Add index for timeline queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_time ON public.tasks(due_date, start_time, end_time);

-- Add index for assigned_to queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_time ON public.tasks(assigned_to, due_date, start_time) WHERE start_time IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN public.tasks.start_time IS 'Start time of the task (time only, date is in due_date)';
COMMENT ON COLUMN public.tasks.end_time IS 'End time of the task (time only, date is in due_date)';
