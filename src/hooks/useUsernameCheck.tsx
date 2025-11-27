import { useEffect } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useUsernameCheck = () => {
  const { profile } = useAuth();

  useEffect(() => {
    const checkUsername = async () => {
      if (!profile) return;

      // Verificar se o usuário não tem username
      const profileWithUsername = profile as any;
      if (!profileWithUsername.username) {
        // Verificar se já existe uma notificação desse tipo para o usuário
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', profile.id)
          .eq('type', 'username_required')
          .maybeSingle();

        // Se não existe notificação, criar uma
        if (!existingNotification) {
          const { error } = await supabase
            .from('notifications')
            .insert({
              user_id: profile.id,
              type: 'username_required',
              title: 'Configure seu username',
              message: 'Para usar todas as funções do app, você precisa configurar um username único.',
              read: false,
            });

          if (error) {
            console.error('Erro ao criar notificação:', error);
          }
        }
      }
    };

    checkUsername();
  }, [profile]);

  return { needsUsername: profile && !(profile as any).username };
};
