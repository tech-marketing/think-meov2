import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, MaterialStatus } from "./StatusBadge";
import { MessageSquare, Calendar, User, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Material {
  id: string;
  name: string;
  type: 'image' | 'video' | 'pdf';
  status: MaterialStatus;
  comments: number;
  thumbnail?: string;
  project?: string;
  company?: string;
  client?: string;
  dueDate?: string;
  is_running?: boolean;
}

interface MaterialsMasonryProps {
  materials: Material[];
  className?: string;
}

export const MaterialsMasonry = ({ materials, className }: MaterialsMasonryProps) => {
  const navigate = useNavigate();

  const handleMaterialClick = (materialId: string) => {
    navigate(`/material/${materialId}`);
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {materials.map((material) => (
        <Card 
          key={material.id}
          className="cursor-pointer hover:shadow-lg transition-all duration-200 group overflow-hidden"
          onClick={() => handleMaterialClick(material.id)}
        >
          <CardContent className="p-0">
            {/* Thumbnail */}
            {material.thumbnail ? (
              <div className="relative aspect-video rounded-t-lg overflow-hidden">
                <img 
                  src={material.thumbnail} 
                  alt={material.name}
                  className="w-full h-full object-cover"
                />
                {material.type === 'video' && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1"></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-blue-50 flex items-center justify-center rounded-t-lg">
                <ImageOff className="h-12 w-12 text-primary/40" />
              </div>
            )}
            
            {/* Content */}
            <div className="p-4 space-y-2">
              <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {material.name}
              </h4>
              
              {material.project && (
                <p className="text-sm text-muted-foreground">
                  {material.project}
                </p>
              )}
              
              {material.company && (
                <p className="text-xs text-muted-foreground uppercase">
                  {material.company} - {material.name}/2025
                </p>
              )}
              
              <div className="pt-2">
                <StatusBadge status={material.status} isRunning={material.is_running} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};