import React, { createContext, useContext, useState, useCallback } from 'react';

interface MaterialsContextType {
  // Trigger para forçar reload de materiais em qualquer componente
  triggerMaterialsRefresh: () => void;
  // Timestamp da última atualização (para ser usado como dependency em useEffect)
  materialsVersion: number;
  // Notificar que um material foi adicionado/atualizado
  notifyMaterialChange: (action: 'created' | 'updated' | 'deleted', materialId?: string) => void;
}

const MaterialsContext = createContext<MaterialsContextType | undefined>(undefined);

export const MaterialsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [materialsVersion, setMaterialsVersion] = useState(0);

  const triggerMaterialsRefresh = useCallback(() => {
    setMaterialsVersion(prev => prev + 1);
  }, []);

  const notifyMaterialChange = useCallback((action: 'created' | 'updated' | 'deleted', materialId?: string) => {
    console.log(`Material ${action}:`, materialId);
    triggerMaterialsRefresh();
  }, [triggerMaterialsRefresh]);

  const value: MaterialsContextType = {
    triggerMaterialsRefresh,
    materialsVersion,
    notifyMaterialChange,
  };

  return (
    <MaterialsContext.Provider value={value}>
      {children}
    </MaterialsContext.Provider>
  );
};

export const useMaterials = () => {
  const context = useContext(MaterialsContext);
  if (context === undefined) {
    throw new Error('useMaterials must be used within a MaterialsProvider');
  }
  return context;
};