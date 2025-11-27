import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, XCircle, User, Users } from "lucide-react";

export type MaterialStatus = 
  | 'approved' 
  | 'pending' 
  | 'needs_adjustment' 
  | 'rejected'
  | 'client_approval'
  | 'internal_approval'
  | 'processing'
  | 'failed';

interface StatusBadgeProps {
  status: MaterialStatus;
  className?: string;
  isRunning?: boolean;
}

const statusConfig = {
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-orange-50 text-orange-600 border-orange-200 shadow-sm"
  },
  processing: {
    label: "Processando",
    icon: Clock,
    className: "bg-blue-50 text-blue-600 border-blue-200 shadow-sm animate-pulse"
  },
  approved: {
    label: "Aprovado",
    icon: CheckCircle,
    className: "bg-success-light text-success-foreground border-success/30 shadow-sm"
  },
  needs_adjustment: {
    label: "Ajustes Necessários",
    icon: AlertCircle,
    className: "bg-warning-light text-warning-foreground border-warning/30 shadow-sm"
  },
  rejected: {
    label: "Rejeitado",
    icon: XCircle,
    className: "bg-destructive-light text-destructive border-destructive/40 shadow-sm font-medium"
  },
  client_approval: {
    label: "Em Veiculação",
    icon: User,
    className: "bg-success-light text-success-foreground border-success/30 shadow-sm"
  },
  internal_approval: {
    label: "Aprovado Interno",
    icon: Users,
    className: "bg-purple-50 text-purple-600 border-purple-200 shadow-sm"
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "bg-red-50 text-red-600 border-red-200 shadow-sm"
  }
};

export const StatusBadge = ({ status, className, isRunning = true }: StatusBadgeProps) => {
  const config = statusConfig[status];
  if (!config || !config.icon) return null;
  const Icon = config.icon;

  // Se status é client_approval e isRunning é false, mudar label
  const label = status === 'client_approval' && !isRunning ? 'Disponível' : config.label;

  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, "font-medium", className)}
    >
      <Icon className="w-3 h-3 mr-1.5" />
      {label}
    </Badge>
  );
};