import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, MaterialStatus } from "./StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Thumbnail } from "./Thumbnail";
import { Eye, MessageSquare, Calendar, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { DeleteProjectModal } from "./DeleteProjectModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel';
  status: MaterialStatus;
  comments: number;
  thumbnail?: string;
  is_running?: boolean;
}

interface ProjectCardProps {
  id: string;
  name: string;
  client: string;
  companyLogo?: string | null;
  materials: Material[];
  dueDate: string;
  className?: string;
  canDelete?: boolean;
}

export const ProjectCard = ({ 
  id, 
  name, 
  client,
  companyLogo,
  materials, 
  dueDate, 
  className,
  canDelete = false
}: ProjectCardProps) => {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const pendingCount = materials.filter(m => 
    m.status === 'pending' || 
    m.status === 'internal_approval' || 
    m.status === 'needs_adjustment' || 
    m.status === 'rejected'
  ).length;
  const totalComments = materials.reduce((sum, m) => sum + m.comments, 0);

  const handleMaterialClick = (materialId: string) => {
    navigate(`/material/${materialId}`);
  };

  const handleProjectClick = () => {
    navigate(`/project/${id}`);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  return (
    <>
      <Card 
        className={cn("hover:shadow-medium transition-all duration-200 cursor-pointer group", className)}
        onClick={handleProjectClick}
      >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
              {name}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Avatar className="h-5 w-5 flex-shrink-0">
                <AvatarImage src={companyLogo} alt={client} />
                <AvatarFallback className="text-xs">
                  {client.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{client}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="whitespace-nowrap">{dueDate}</span>
            </div>
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-accent transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick();
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir projeto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex items-center justify-between text-sm flex-wrap gap-2">
          <div className="flex items-center space-x-3 flex-wrap gap-1">
            <span className="text-warning font-medium whitespace-nowrap">
              {pendingCount} pendentes
            </span>
          </div>
          <div className="flex items-center space-x-1 text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>{totalComments}</span>
          </div>
        </div>

        {/* Recent Materials */}
        <div className="space-y-2">
          {materials.slice(0, 3).map((material) => (
            <div 
              key={material.id}
              className="flex items-center justify-between p-2 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer gap-2"
              onClick={(e) => {
                e.stopPropagation();
                handleMaterialClick(material.id);
              }}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <Thumbnail 
                  type={material.type}
                  thumbnail={material.thumbnail}
                  name={material.name}
                  size="sm"
                  className="flex-shrink-0"
                />
                <span className="text-sm font-medium truncate">
                  {material.name}
                </span>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                {material.comments > 0 && (
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>{material.comments}</span>
                  </div>
                )}
                <StatusBadge status={material.status} isRunning={material.is_running} />
              </div>
            </div>
          ))}
          
          {materials.length > 3 && (
            <div className="text-center py-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProjectClick();
                }}
              >
                <Eye className="h-3 w-3 mr-1" />
                Ver todos ({materials.length} materiais)
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    
    <DeleteProjectModal
      projectId={id}
      projectName={name}
      open={showDeleteModal}
      onOpenChange={setShowDeleteModal}
    />
  </>
  );
};
