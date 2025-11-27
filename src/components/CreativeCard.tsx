import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, MousePointer, DollarSign, TrendingUp, ExternalLink } from "lucide-react";

interface MetaAd {
  id: string;
  ad_id: string;
  ad_name: string;
  status: string;
  taxonomy_status: string;
  local_material_id: string | null;
  campaign_name?: string;
  metrics?: {
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    spend: number;
    conversions: number;
    conversion_rate: number;
    roas: number;
  };
}

interface CreativeCardProps {
  ad: MetaAd;
  rank?: number;
  onViewDetails?: (ad: MetaAd) => void;
}

export const CreativeCard: React.FC<CreativeCardProps> = ({ ad, rank, onViewDetails }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'disabled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTaxonomyStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {rank && (
              <Badge variant="outline" className="mb-2">
                #{rank}
              </Badge>
            )}
            <CardTitle className="text-lg line-clamp-2">{ad.ad_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{ad.campaign_name}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Badge className={getStatusColor(ad.status)}>
              {ad.status}
            </Badge>
            <Badge variant="outline" className={getTaxonomyStatusColor(ad.taxonomy_status)}>
              {ad.taxonomy_status || 'pending'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {ad.metrics && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Impressões</p>
                <p className="font-semibold">{ad.metrics.impressions.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="font-semibold">{ad.metrics.ctr.toFixed(2)}%</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">CPC</p>
                <p className="font-semibold">${ad.metrics.cpc.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">ROAS</p>
                <p className="font-semibold">{ad.metrics.roas.toFixed(2)}x</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onViewDetails?.(ad)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};