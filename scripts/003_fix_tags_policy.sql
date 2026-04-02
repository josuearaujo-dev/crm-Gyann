-- Atualizar policy de delete de tags para permitir que o criador delete suas próprias tags
DROP POLICY IF EXISTS "tags_delete_admin" ON public.tags;

CREATE POLICY "tags_delete_own_or_admin" ON public.tags FOR DELETE USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
