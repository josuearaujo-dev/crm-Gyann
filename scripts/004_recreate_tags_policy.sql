-- Drop existing policy
DROP POLICY IF EXISTS tags_delete_own_or_admin ON public.tags;

-- Create new policy allowing users to delete their own tags
CREATE POLICY tags_delete_own_or_admin ON public.tags
  FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
