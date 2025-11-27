-- Create support_conversations table
create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  support_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique(user_id, support_user_id)
);

-- Create indexes for performance
create index idx_support_conversations_user on support_conversations(user_id);
create index idx_support_conversations_support on support_conversations(support_user_id);
create index idx_support_conversations_status on support_conversations(status);
create index idx_support_conversations_last_message on support_conversations(last_message_at desc);

-- Create support_messages table
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now(),
  
  constraint content_not_empty check (length(trim(content)) > 0)
);

-- Create indexes for performance
create index idx_support_messages_conversation on support_messages(conversation_id);
create index idx_support_messages_sender on support_messages(sender_id);
create index idx_support_messages_created on support_messages(created_at desc);

-- Enable Row Level Security
alter table support_conversations enable row level security;
alter table support_messages enable row level security;

-- RLS Policies for support_conversations
create policy "Users can view their own conversations"
  on support_conversations for select
  using (auth.uid() = user_id or auth.uid() = support_user_id);

create policy "Users can create conversations"
  on support_conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their conversations"
  on support_conversations for update
  using (auth.uid() = user_id or auth.uid() = support_user_id);

-- RLS Policies for support_messages
create policy "Users can view messages from their conversations"
  on support_messages for select
  using (
    exists (
      select 1 from support_conversations
      where id = conversation_id
      and (user_id = auth.uid() or support_user_id = auth.uid())
    )
  );

create policy "Users can send messages"
  on support_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from support_conversations
      where id = conversation_id
      and (user_id = auth.uid() or support_user_id = auth.uid())
    )
  );

create policy "Users can update message read status"
  on support_messages for update
  using (
    exists (
      select 1 from support_conversations
      where id = conversation_id
      and (user_id = auth.uid() or support_user_id = auth.uid())
    )
  );

-- Trigger function to update last_message_at
create or replace function update_conversation_last_message()
returns trigger as $$
begin
  update support_conversations
  set 
    last_message_at = now(),
    updated_at = now()
  where id = NEW.conversation_id;
  
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

-- Create trigger
create trigger on_support_message_created
  after insert on support_messages
  for each row
  execute function update_conversation_last_message();

-- Enable realtime
alter publication supabase_realtime add table support_messages;
alter publication supabase_realtime add table support_conversations;