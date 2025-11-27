-- Remove políticas antigas e duplicadas que não cobrem todos os casos necessários
DROP POLICY IF EXISTS "Project participants can view each other" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles of project participants" ON public.profiles;

-- Cria uma política abrangente: usuários podem ver profiles de qualquer pessoa relacionada 
-- a projetos que eles têm permissão de visualizar
CREATE POLICY "Users can view profiles from accessible projects"
ON public.profiles
FOR SELECT
USING (
  -- Admins veem tudo (mantido para não interferir com política existente)
  get_current_user_role() = 'admin'
  OR
  -- Profile do próprio usuário (mantido para não interferir com política existente)
  auth.uid() = user_id
  OR
  -- Profiles de usuários da mesma empresa (mantido para não interferir com política existente)
  (company_id IS NOT NULL AND company_id = get_current_user_company_id())
  OR
  -- Novo: Profiles de pessoas relacionadas a projetos que o usuário pode visualizar
  profiles.id IN (
    SELECT DISTINCT related_profile_id FROM (
      -- Criadores de projetos acessíveis
      SELECT p.created_by as related_profile_id
      FROM public.projects p
      WHERE (p.company_id = ANY (get_user_allowed_companies()) OR get_current_user_role() = 'admin')
      
      UNION
      
      -- Participantes de projetos acessíveis
      SELECT pp.user_id as related_profile_id
      FROM public.project_participants pp
      JOIN public.projects p ON pp.project_id = p.id
      WHERE (p.company_id = ANY (get_user_allowed_companies()) OR get_current_user_role() = 'admin')
      
      UNION
      
      -- Criadores de materiais em projetos acessíveis
      SELECT m.created_by as related_profile_id
      FROM public.materials m
      JOIN public.projects p ON m.project_id = p.id
      WHERE (p.company_id = ANY (get_user_allowed_companies()) OR get_current_user_role() = 'admin')
      
      UNION
      
      -- Revisores de materiais em projetos acessíveis
      SELECT m.reviewed_by as related_profile_id
      FROM public.materials m
      JOIN public.projects p ON m.project_id = p.id
      WHERE m.reviewed_by IS NOT NULL
        AND (p.company_id = ANY (get_user_allowed_companies()) OR get_current_user_role() = 'admin')
      
      UNION
      
      -- Autores de comentários em materiais de projetos acessíveis
      SELECT c.author_id as related_profile_id
      FROM public.comments c
      JOIN public.materials m ON c.material_id = m.id
      JOIN public.projects p ON m.project_id = p.id
      WHERE (p.company_id = ANY (get_user_allowed_companies()) OR get_current_user_role() = 'admin')
      
      UNION
      
      -- Pessoas que adicionaram participantes em projetos acessíveis
      SELECT pp.added_by as related_profile_id
      FROM public.project_participants pp
      JOIN public.projects p ON pp.project_id = p.id
      WHERE (p.company_id = ANY (get_user_allowed_companies()) OR get_current_user_role() = 'admin')
    ) AS all_related_profiles
  )
);