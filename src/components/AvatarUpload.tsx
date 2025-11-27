import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ImageCropper } from "@/components/ImageCropper";

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onAvatarUpdate: (newUrl: string) => void;
}

export const AvatarUpload = ({ currentAvatarUrl, onAvatarUpdate }: AvatarUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImageForCrop, setSelectedImageForCrop] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { profile, updateProfile } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Por favor, selecione uma imagem válida",
      });
      return;
    }

    // Validate file size (max 50MB)
    const MAX_AVATAR_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_AVATAR_SIZE) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "A imagem deve ter no máximo 50MB",
      });
      return;
    }

    // Create preview URL for cropping
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImageForCrop(e.target?.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedFileResult: File) => {
    setCroppedFile(croppedFileResult);
    
    // Create preview URL for the cropped image
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(croppedFileResult);
  };

  const handleUpload = async () => {
    if (!croppedFile || !profile?.user_id) return;

    const file = croppedFile;
    setIsUploading(true);

    try {
      // Upload avatar via Edge Function para GCS
      console.log('Fazendo upload de avatar para GCS...');
      
      // Criar FormData para enviar o arquivo
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', `avatars/${profile.user_id}`);

      // Chamar Edge Function para upload no GCS
      const { data: uploadResult, error: uploadError } = await supabase.functions
        .invoke('upload-to-storage', {
          body: formData
        });

      if (uploadError || !uploadResult?.path) {
        console.error('Erro no upload de avatar via GCS:', uploadError);
        throw uploadError || new Error('Upload falhou - URL não retornada');
      }

      const publicUrl = uploadResult.path;
      console.log('Avatar uploaded to GCS:', publicUrl);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile.user_id);

      if (updateError) throw updateError;

      // Atualizar contexto de autenticação
      await updateProfile();
      
      onAvatarUpdate(publicUrl);
      setIsOpen(false);
      setPreviewUrl(null);
      setCroppedFile(null);
      setSelectedImageForCrop(null);
      
      toast({
        title: "Sucesso",
        description: "Foto de perfil atualizada com sucesso!",
      });

    } catch (error) {
      console.error('Erro ao fazer upload do avatar:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao atualizar foto de perfil",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setCroppedFile(null);
    setSelectedImageForCrop(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="relative group cursor-pointer">
          <Avatar className="h-28 w-28">
            <AvatarImage src={currentAvatarUrl || ""} />
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {profile?.full_name?.substring(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-8 w-8 text-white" />
          </div>
        </div>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Foto de Perfil</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Preview Area */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-32 w-32">
                <AvatarImage src={previewUrl || currentAvatarUrl || ""} />
                <AvatarFallback className="text-2xl">
                  {profile?.full_name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {previewUrl && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={clearPreview}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* File Input */}
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Escolher Imagem
            </Button>

            <div className="text-xs text-muted-foreground text-center">
              Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!previewUrl || isUploading}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Salvar"}
            </Button>
          </div>
        </div>

        {selectedImageForCrop && (
          <ImageCropper
            open={cropperOpen}
            onOpenChange={setCropperOpen}
            imageSrc={selectedImageForCrop}
            onCropComplete={handleCropComplete}
            aspectRatio={1}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};