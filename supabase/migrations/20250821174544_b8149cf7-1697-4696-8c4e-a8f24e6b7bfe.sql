-- Criar tabela para emails autorizados a se cadastrar
CREATE TABLE public.authorized_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'client',
  company_id uuid REFERENCES public.companies(id),
  allowed_companies uuid[] DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone NULL
);

-- Habilitar RLS
ALTER TABLE public.authorized_emails ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para authorized_emails
CREATE POLICY "Admins can manage authorized emails" 
ON public.authorized_emails 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Permitir que usuários vejam apenas seu próprio email autorizado
CREATE POLICY "Users can view their own authorized email" 
ON public.authorized_emails 
FOR SELECT 
TO authenticated
USING (
  email = (
    SELECT email FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);