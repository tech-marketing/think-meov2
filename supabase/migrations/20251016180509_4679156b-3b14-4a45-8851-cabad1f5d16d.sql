-- Create function to get conversation user profile (bypasses RLS)
create or replace function public.get_conversation_user_profile(_conversation_id uuid)
returns table(full_name text, email text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name, p.email, p.avatar_url
  from public.support_conversations sc
  join public.profiles p on p.user_id = sc.user_id
  where sc.id = _conversation_id
    and (sc.user_id = auth.uid() or sc.support_user_id = auth.uid())
  limit 1;
$$;

-- Grant execution to authenticated users
grant execute on function public.get_conversation_user_profile(uuid) to authenticated;