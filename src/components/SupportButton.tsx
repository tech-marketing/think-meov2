import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { SupportChatModal } from './SupportChatModal';
import { SupportDashboard } from './SupportDashboard';

export const SupportButton = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isSupportAccount = profile?.email === 'tech@thinkcompany.com.br';

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform bg-primary text-primary-foreground"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {isOpen && (
        isSupportAccount ? (
          <SupportDashboard onClose={() => setIsOpen(false)} />
        ) : (
          <SupportChatModal onClose={() => setIsOpen(false)} />
        )
      )}
    </div>
  );
};
