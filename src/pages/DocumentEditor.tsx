import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DocumentEditor as DocumentEditorComponent } from '@/components/document-editor/DocumentEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<string | undefined>();
  const [documentName, setDocumentName] = useState('Novo Documento');

  useEffect(() => {
    if (id) {
      loadDocument();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadDocument = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data.wireframe_data) {
        setInitialData(JSON.stringify(data.wireframe_data));
      }
      setDocumentName(data.name);
    } catch (error: any) {
      console.error('Error loading document:', error);
      toast.error('Erro ao carregar documento');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: string) => {
    if (!id) {
      toast.error('ID do documento não encontrado');
      return;
    }

    try {
      const canvasData = JSON.parse(data);

      const { error } = await supabase
        .from('materials')
        .update({
          wireframe_data: canvasData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Documento salvo com sucesso');
    } catch (error: any) {
      console.error('Error saving document:', error);
      toast.error('Erro ao salvar documento');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DocumentEditorComponent
      documentId={id}
      initialData={initialData}
      onSave={handleSave}
    />
  );
}
