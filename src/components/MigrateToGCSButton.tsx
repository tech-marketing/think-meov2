import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const MigrateToGCSButton = () => {
  const [migrating, setMigrating] = useState(false);
  const { toast } = useToast();

  const handleMigration = async () => {
    setMigrating(true);
    
    try {
      toast({
        title: "Migração Iniciada",
        description: "A migração dos arquivos para o Google Cloud Storage foi iniciada. Isso pode levar alguns minutos...",
      });

      const { data, error } = await supabase.functions.invoke('migrate-to-gcs', {
        body: {}
      });

      if (error) {
        console.error('Erro na migração:', error);
        throw error;
      }

      console.log('Resultado da migração:', data);

      toast({
        title: "Migração Concluída!",
        description: `${data.migratedCount} arquivos foram migrados com sucesso para o GCS.${data.errors ? ` Erros: ${data.errors.length}` : ''}`,
      });

      // Se houver erros, mostrar detalhes
      if (data.errors && data.errors.length > 0) {
        console.error('Erros durante a migração:', data.errors);
        toast({
          title: "Alguns arquivos falharam",
          description: `${data.errors.length} arquivos não puderam ser migrados. Verifique o console para detalhes.`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Erro ao executar migração:', error);
      toast({
        title: "Erro na Migração",
        description: "Ocorreu um erro ao migrar os arquivos. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2"
          disabled={migrating}
        >
          {migrating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Migrando...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Migrar para GCS
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Migrar Arquivos para Google Cloud Storage</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Esta operação irá migrar todos os arquivos existentes do Supabase Storage para o Google Cloud Storage.
            </p>
            <p className="font-semibold text-foreground">
              O processo inclui:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Download de todos os arquivos dos buckets 'materials' e 'avatars'</li>
              <li>Upload para o Google Cloud Storage</li>
              <li>Atualização das URLs no banco de dados</li>
            </ul>
            <p className="text-warning">
              ⚠️ Esta operação pode levar vários minutos dependendo da quantidade de arquivos.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={migrating}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleMigration}
            disabled={migrating}
          >
            {migrating ? "Migrando..." : "Iniciar Migração"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
