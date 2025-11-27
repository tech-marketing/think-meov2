-- Update tech@thinkcompany.com.br to admin role
UPDATE public.profiles 
SET role = 'admin'::user_role
WHERE email = 'tech@thinkcompany.com.br';