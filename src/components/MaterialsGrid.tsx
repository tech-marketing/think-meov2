import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, MaterialStatus } from "./StatusBadge";
import { Thumbnail } from "./Thumbnail";
import { MessageSquare, Edit2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf' | 'wireframe' | 'carousel';
  status: MaterialStatus;
  comments: number;
  thumbnail?: string;
  project?: string;
  company?: string;
  caption?: string;
  is_briefing?: boolean;
  briefing_approved_by_client?: boolean;
  is_running?: boolean;
}

interface MaterialsGridProps {
  materials: Material[];
  viewMode?: 'grid' | 'list';
  className?: string;
  onMaterialUpdated?: () => void;
  onMaterialClick?: (materialId: string) => void;
  currentStatusFilter?: string;
}

export const MaterialsGrid = ({ 
  materials, 
  viewMode = 'grid', 
  className, 
  onMaterialUpdated,
  onMaterialClick: customOnMaterialClick,
  currentStatusFilter
}: MaterialsGridProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [localMaterials, setLocalMaterials] = useState(materials);

  // Update local materials when props change
  useEffect(() => {
    setLocalMaterials(materials);
  }, [materials]);

  const handleMaterialClick = (materialId: string) => {
    if (customOnMaterialClick) {
      customOnMaterialClick(materialId);
    } else {
      const statusParam = currentStatusFilter ? `?status=${currentStatusFilter}` : '';
      navigate(`/material/${materialId}${statusParam}`);
    }
  };

  const startEditing = (material: Material, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(material.id);
    setEditingName(material.name);
  };

  const saveEdit = async (materialId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!editingName.trim()) {
      toast({
        title: "Erro",
        description: "O nome não pode estar vazio",
        variant: "destructive"
      });
      return;
    }

    try {
      // Update optimistically
      setLocalMaterials(prev => prev.map(m => 
        m.id === materialId ? { ...m, name: editingName.trim() } : m
      ));

      const { error } = await supabase
        .from('materials')
        .update({ name: editingName.trim() })
        .eq('id', materialId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nome do briefing atualizado!"
      });

      setEditingId(null);
      setEditingName("");
      onMaterialUpdated?.();
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      // Revert optimistic update
      setLocalMaterials(materials);
      toast({
        title: "Erro",
        description: "Erro ao atualizar nome do briefing",
        variant: "destructive"
      });
    }
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingName("");
  };

  const canEdit = (material: Material) => {
    return material.is_briefing && !material.briefing_approved_by_client;
  };

  if (viewMode === 'list') {
    return (
      <div className={cn("space-y-4", className)}>
        {materials.map((material) => (
          <Card 
            key={material.id}
            className="cursor-pointer hover:shadow-elegant transition-shadow duration-300 group bg-card/50 backdrop-blur-sm border-0"
            onClick={() => handleMaterialClick(material.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 relative overflow-hidden rounded-lg">
                  <Thumbnail 
                    type={material.type}
                    thumbnail={material.thumbnail}
                    name={material.name}
                    size="md"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingId === material.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(material.id, e as any);
                              if (e.key === 'Escape') cancelEdit(e as any);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={(e) => saveEdit(material.id, e)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">
                            {material.name}
                          </h3>
                          {canEdit(material) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => startEditing(material, e)}
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                      {material.caption && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {material.caption}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                        {material.company && (
                          <span className="font-medium truncate">{material.company}</span>
                        )}
                        {material.project && (
                          <span className="truncate">{material.project}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Status and Comments */}
                    <div className="flex items-center space-x-3 ml-4">
                      <StatusBadge status={material.status} isRunning={material.is_running} />
                      {material.comments > 0 && (
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                          <MessageSquare className="h-4 w-4" />
                          <span>{material.comments}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
      {localMaterials.map((material) => (
        <Card 
          key={material.id}
          className="cursor-pointer hover:shadow-elegant transition-shadow duration-300 group bg-card/50 backdrop-blur-sm border-0 p-1"
          onClick={() => handleMaterialClick(material.id)}
        >
          <CardContent className="p-0">
            {/* Large Thumbnail */}
            <div className="aspect-[4/3] relative overflow-hidden rounded-t-lg">
              <Thumbnail 
                type={material.type}
                thumbnail={material.thumbnail}
                name={material.name}
                size="xl"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                {editingId === material.id ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(material.id, e as any);
                        if (e.key === 'Escape') cancelEdit(e as any);
                      }}
                    />
                    <Button size="sm" variant="ghost" onClick={(e) => saveEdit(material.id, e)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors flex-1">
                      {material.name}
                    </h4>
                    {canEdit(material) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => startEditing(material, e)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                {material.caption && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {material.caption}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  {material.company && (
                    <span className="font-medium truncate">{material.company}</span>
                  )}
                  {material.project && (
                    <span className="text-xs truncate">{material.project}</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <StatusBadge status={material.status} isRunning={material.is_running} />
                {material.comments > 0 && (
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <MessageSquare className="h-4 w-4" />
                    <span>{material.comments}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};