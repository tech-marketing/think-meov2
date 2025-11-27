-- Função para retornar participantes do projeto para menções
-- Permite que qualquer usuário do projeto veja todos os outros participantes
CREATE OR REPLACE FUNCTION public.get_project_participants_for_mentions(_project_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  username text,
  avatar_url text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH project_users AS (
    -- Criador do projeto
    SELECT 
      p.user_id,
      p.full_name,
      p.email,
      p.username,
      p.avatar_url,
      p.role
    FROM profiles p
    INNER JOIN projects proj ON proj.created_by = p.id
    WHERE proj.id = _project_id
    
    UNION
    
    -- Participantes do projeto
    SELECT 
      p.user_id,
      p.full_name,
      p.email,
      p.username,
      p.avatar_url,
      p.role
    FROM profiles p
    INNER JOIN project_participants pp ON pp.user_id = p.user_id
    WHERE pp.project_id = _project_id
  )
  SELECT DISTINCT 
    pu.user_id,
    pu.full_name,
    pu.email,
    pu.username,
    pu.avatar_url,
    pu.role
  FROM project_users pu
  ORDER BY pu.full_name;
END;
$$;