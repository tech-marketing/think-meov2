import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  full_name: string;
  email: string;
  username?: string;
  avatar_url?: string;
  role?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  projectId?: string;
  onMentionUsers?: (users: User[]) => void;
}

export const MentionInput = ({
  value,
  onChange,
  placeholder = "Adicione seus comentários... Use @ para mencionar alguém",
  className,
  projectId,
  onMentionUsers
}: MentionInputProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carregar usuários do projeto usando função security definer
  useEffect(() => {
    const loadUsers = async () => {
      if (!projectId) return;

      try {
        // Usar função RPC security definer para garantir que todos os usuários
        // possam ver os participantes do projeto, independente de RLS
        const { data: projectUsers, error } = await supabase
          .rpc('get_project_participants_for_mentions', {
            _project_id: projectId
          });

        if (error) {
          console.error('Erro ao carregar usuários:', error);
          return;
        }

        const allUsers: User[] = projectUsers?.map(u => ({
          id: u.user_id,  // auth.uid() - sempre correto
          full_name: u.full_name,
          email: u.email,
          username: u.username,
          avatar_url: u.avatar_url,
          role: u.role
        })) || [];

        setUsers(allUsers);
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };

    loadUsers();
  }, [projectId]);

  // Detectar @ e filtrar sugestões
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      
      // Só mostrar sugestões se não tiver espaço após @
      if (!textAfterAt.includes(' ')) {
        setMentionStartPos(lastAtSymbol);
        setMentionQuery(textAfterAt);
        
        const specialMentions = [
          { id: 'all', full_name: 'Todos', email: 'Mencionar todos os participantes', username: undefined, role: 'special' },
          { id: 'all-collaborators', full_name: 'Todos Colaboradores', email: 'Mencionar todos os colaboradores', username: undefined, role: 'special' },
          { id: 'all-clients', full_name: 'Todos Clientes', email: 'Mencionar todos os clientes', username: undefined, role: 'special' },
        ];

        const filtered = [...specialMentions, ...users].filter(user =>
          user.full_name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          (user.username && user.username.toLowerCase().includes(textAfterAt.toLowerCase())) ||
          user.email.toLowerCase().includes(textAfterAt.toLowerCase())
        );

        setFilteredUsers(filtered);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionStartPos(null);
  }, [value, users]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectUser(filteredUsers[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectUser = (user: User) => {
    if (mentionStartPos === null) return;

    const beforeMention = value.substring(0, mentionStartPos);
    const afterMention = value.substring(mentionStartPos + mentionQuery.length + 1);
    
    let mentionText: string;
    let mentionedUsers: User[] = [];
    
    if (user.id === 'all') {
      mentionText = '@todos';
      mentionedUsers = users;
    } else if (user.id === 'all-collaborators') {
      mentionText = '@todos-colaboradores';
      mentionedUsers = users.filter(u => u.role === 'collaborator');
    } else if (user.id === 'all-clients') {
      mentionText = '@todos-clientes';
      mentionedUsers = users.filter(u => u.role === 'client');
    } else {
      mentionText = user.username ? `@${user.username}` : `@${user.email}`;
      mentionedUsers = [user];
    }
    
    const newText = beforeMention + mentionText + ' ' + afterMention;
    
    onChange(newText);
    setShowSuggestions(false);
    setMentionStartPos(null);

    // Notificar usuários mencionados
    if (onMentionUsers) {
      const allMentionedUsers = extractMentionedUsers(newText);
      onMentionUsers(allMentionedUsers);
    }

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartPos + mentionText.length + 1;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const extractMentionedUsers = (text: string): User[] => {
    const mentionedUsers: User[] = [];

    // Menções especiais
    if (/@todos(\b|$)/i.test(text)) {
      users.forEach(u => {
        if (!mentionedUsers.find(mu => mu.id === u.id)) mentionedUsers.push(u);
      });
    }
    if (/@todos-colaboradores(\b|$)/i.test(text)) {
      users.filter(u => u.role === 'collaborator').forEach(u => {
        if (!mentionedUsers.find(mu => mu.id === u.id)) mentionedUsers.push(u);
      });
    }
    if (/@todos-clientes(\b|$)/i.test(text)) {
      users.filter(u => u.role === 'client').forEach(u => {
        if (!mentionedUsers.find(mu => mu.id === u.id)) mentionedUsers.push(u);
      });
    }

    // Menções individuais por username ou email
    users.forEach(user => {
      if (user.username) {
        const usernamePattern = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, 'i');
        if (usernamePattern.test(text)) {
          if (!mentionedUsers.find(mu => mu.id === user.id)) {
            mentionedUsers.push(user);
          }
          return;
        }
      }
      
      // Fallback para email (para compatibilidade com menções antigas)
      const mentionPattern = new RegExp(`@${user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, 'i');
      if (mentionPattern.test(text)) {
        if (!mentionedUsers.find(mu => mu.id === user.id)) {
          mentionedUsers.push(user);
        }
      }
    });

    return mentionedUsers;
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("min-h-[100px]", className)}
      />
      
      {/* Sugestões de menção */}
      {showSuggestions && (
        <div 
          className="absolute z-50 w-80 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1"
        >
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors",
                index === selectedIndex && "bg-accent"
              )}
              onClick={() => selectUser(user)}
            >
              <Avatar className="h-6 w-6">
                {user.role === 'special' ? (
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    @
                  </AvatarFallback>
                ) : (
                  <>
                    <AvatarImage src={user.avatar_url} alt={user.full_name} />
                    <AvatarFallback className="text-xs">
                      {user.full_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{user.full_name}</p>
                  {user.role && user.role !== 'special' && (
                    <Badge 
                      variant={user.role === 'admin' ? 'destructive' : user.role === 'collaborator' ? 'default' : 'secondary'}
                      className="text-xs h-4"
                    >
                      {user.role === 'admin' ? 'Admin' : user.role === 'collaborator' ? 'Colaborador' : 'Cliente'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {user.username ? `@${user.username}` : user.email}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
