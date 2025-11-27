import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ChangeMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string;
  materialName: string;
  currentVersionCount: number;
  onSuccess: () => void;
}

export const ChangeMaterialModal = ({
  open,
  onOpenChange,
  materialId,
  materialName,
  currentVersionCount,
  onSuccess
}: ChangeMaterialModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const maxVersions = 3;
  const canAddVersion = currentVersionCount < maxVersions;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
      if (selectedFile.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 2GB",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !profile?.id) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo",
        variant: "destructive"
      });
      return;
    }

    if (!canAddVersion) {
      toast({
        title: "Limite atingido",
        description: "Limite máximo de 3 alterações por material atingido",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      // 1. Buscar dados atuais do material
      const { data: currentMaterial, error: fetchError } = await supabase
        .from('materials')
        .select('file_url, thumbnail_url, wireframe_data, version_count')
        .eq('id', materialId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Salvar versão atual antes de substituir
      const nextVersionNumber = (currentMaterial.version_count || 0) + 1;
      
      const { error: versionError } = await supabase
        .from('material_versions')
        .insert({
          material_id: materialId,
          version_number: currentMaterial.version_count || 0,
          file_url: currentMaterial.file_url,
          thumbnail_url: currentMaterial.thumbnail_url,
          wireframe_data: currentMaterial.wireframe_data,
          created_by: profile.id,
          notes: `Versão ${currentMaterial.version_count || 0} (backup automático)`
        });

      if (versionError) throw versionError;

      // 3. Upload do novo arquivo via Edge Function para GCS
      console.log('Fazendo upload para GCS via Edge Function...');
      
      // Criar FormData para enviar o arquivo
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `materials/${profile.id}`);

      // Chamar Edge Function para upload no GCS
      const { data: uploadResult, error: uploadError } = await supabase.functions
        .invoke('upload-to-storage', {
          body: formData
        });

      if (uploadError || !uploadResult?.path) {
        console.error('Erro no upload via GCS:', uploadError);
        throw uploadError || new Error('Upload falhou - URL não retornada');
      }

      const publicUrl = uploadResult.path;
      console.log('Arquivo enviado para GCS:', publicUrl);

      // 4. Atualizar material com novo arquivo
      const { error: updateError } = await supabase
        .from('materials')
        .update({
          file_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', materialId);

      if (updateError) throw updateError;

      // 5. Criar registro da nova versão com as notas
      if (notes.trim()) {
        await supabase
          .from('material_versions')
          .insert({
            material_id: materialId,
            version_number: nextVersionNumber,
            file_url: publicUrl,
            created_by: profile.id,
            notes: notes.trim()
          });
      }

      toast({
        title: "Sucesso!",
        description: `Material atualizado para versão ${nextVersionNumber}`
      });

      setFile(null);
      setNotes("");
      onOpenChange(false);
      onSuccess();

    } catch (error) {
      console.error('Erro ao alterar material:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar material",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Material</DialogTitle>
          <DialogDescription>
            {materialName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!canAddVersion && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">
                <p className="font-medium">Limite de alterações atingido</p>
                <p className="mt-1">Este material já atingiu o limite máximo de {maxVersions} alterações.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Versão atual: {currentVersionCount || 0} de {maxVersions}</Label>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${((currentVersionCount || 0) / maxVersions) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Novo arquivo</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                disabled={!canAddVersion || uploading}
                accept="image/*,video/*,.pdf"
              />
              <label 
                htmlFor="file" 
                className={`cursor-pointer flex flex-col items-center gap-2 ${!canAddVersion ? 'opacity-50' : ''}`}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm">
                  {file ? (
                    <span className="text-primary font-medium">{file.name}</span>
                  ) : (
                    <>
                      <span className="text-primary font-medium">Clique para escolher</span>
                      <span className="text-muted-foreground"> ou arraste o arquivo</span>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas da alteração (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva as mudanças feitas nesta versão..."
              rows={3}
              disabled={!canAddVersion || uploading}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!file || !canAddVersion || uploading}
            >
              {uploading ? "Enviando..." : "Confirmar Alteração"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
