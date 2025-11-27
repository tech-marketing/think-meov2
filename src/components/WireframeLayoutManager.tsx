import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  History,
  Clock,
  User,
  Eye,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Download,
  Trash2
} from "lucide-react";
import { WireframeLayout } from '@/hooks/useWireframeLayout';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { validateLayout } from '@/utils/wireframeUtils';

interface LayoutVersion {
  id: string;
  version: number;
  layout: WireframeLayout;
  createdAt: string;
  createdBy: string;
}

interface WireframeLayoutManagerProps {
  versions: LayoutVersion[];
  currentLayout: WireframeLayout;
  onRestoreVersion: (layout: WireframeLayout) => void;
  onLoadVersions: () => void;
}

export const WireframeLayoutManager: React.FC<WireframeLayoutManagerProps> = ({
  versions,
  currentLayout,
  onRestoreVersion,
  onLoadVersions
}) => {
  const [selectedVersion, setSelectedVersion] = useState<LayoutVersion | null>(null);

  const handleRestoreVersion = (version: LayoutVersion) => {
    onRestoreVersion(version.layout);
    setSelectedVersion(null);
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  const getVersionStatus = (layout: WireframeLayout) => {
    const validation = validateLayout(layout.elements);
    
    if (!validation.isValid) {
      return { type: 'error', label: 'Inválido', icon: AlertCircle };
    }
    
    if (validation.warnings.length > 0) {
      return { type: 'warning', label: 'Avisos', icon: AlertCircle };
    }
    
    return { type: 'success', label: 'Válido', icon: CheckCircle2 };
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={onLoadVersions}>
          <History className="h-4 w-4 mr-2" />
          Histórico ({versions.length})
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Versões</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Versions List */}
          <div className="space-y-4">
            <h3 className="font-semibold">Versões Salvas</h3>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {versions.map((version) => {
                  const status = getVersionStatus(version.layout);
                  const StatusIcon = status.icon;
                  
                  return (
                    <Card 
                      key={version.id}
                      className={`cursor-pointer transition-colors ${
                        selectedVersion?.id === version.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">v{version.version}</span>
                              <Badge 
                                variant={status.type === 'error' ? 'destructive' : 
                                       status.type === 'warning' ? 'secondary' : 'default'}
                                className="text-xs"
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center text-xs text-muted-foreground gap-3">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {version.createdBy}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(version.createdAt)}
                              </div>
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              Formato: {version.layout.meta.aspectRatio} • 
                              {version.layout.elements.length} elementos
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVersion(version);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {versions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma versão salva ainda</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Version Preview */}
          <div className="space-y-4">
            <h3 className="font-semibold">
              {selectedVersion ? `Pré-visualização - v${selectedVersion.version}` : 'Versão Atual'}
            </h3>
            
            {selectedVersion ? (
              <div className="space-y-4">
                {/* Version Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Informações da Versão</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Versão:</span>
                      <span>v{selectedVersion.version}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Criado por:</span>
                      <span>{selectedVersion.createdBy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Data:</span>
                      <span>{formatDate(selectedVersion.createdAt)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Elementos:</span>
                      <span>{selectedVersion.layout.elements.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Formato:</span>
                      <span>{selectedVersion.layout.meta.aspectRatio}</span>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Layout Validation */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Validação do Layout</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const validation = validateLayout(selectedVersion.layout.elements);
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {validation.isValid ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600">Layout válido</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-600">Layout com problemas</span>
                              </>
                            )}
                          </div>
                          
                          {validation.errors.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-red-600">Erros:</span>
                              {validation.errors.map((error, index) => (
                                <p key={index} className="text-xs text-red-600">• {error}</p>
                              ))}
                            </div>
                          )}
                          
                          {validation.warnings.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-xs font-medium text-yellow-600">Avisos:</span>
                              {validation.warnings.map((warning, index) => (
                                <p key={index} className="text-xs text-yellow-600">• {warning}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
                
                {/* Elements List */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Elementos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedVersion.layout.elements.map((element) => (
                        <div key={element.id} className="flex justify-between items-center text-xs">
                          <span className="font-medium">{element.id}</span>
                          <span className="text-muted-foreground">
                            {Math.round(element.left)}%, {Math.round(element.top)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Separator />
                
                {/* Actions */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleRestoreVersion(selectedVersion)}
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restaurar Versão
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Layout Atual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Versão:</span>
                        <span>v{currentLayout.meta.version} (atual)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Formato:</span>
                        <span>{currentLayout.meta.aspectRatio}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Elementos:</span>
                        <span>{currentLayout.elements.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Última edição:</span>
                        <span>{formatDate(currentLayout.meta.editedAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Selecione uma versão para visualizar</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};