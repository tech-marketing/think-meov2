import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { MaterialsProvider } from "@/contexts/MaterialsContext";

import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import MaterialView from "./pages/MaterialView";
import ProjectView from "./pages/ProjectView";
import Materials from "./pages/Materials";
import MyUploads from "./pages/MyUploads";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import MetaAnalysis from "./pages/MetaAnalysis";
import MetaComparison from "./pages/MetaComparison";
import CreativeDetail from "./pages/CreativeDetail";
import BriefingEditor from "./pages/BriefingEditor";
import TaxonomyAssistant from "./pages/TaxonomyAssistant";
import DocumentEditor from "./pages/DocumentEditor";
import FigmaOAuth from "./pages/FigmaOAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";

const queryClient = new QueryClient();

const AppContent = () => {
  const { loading } = useAuth();

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/figma-oauth" element={<FigmaOAuth />} />
        <Route path="/" element={<ProtectedRoute><AppLayout><Index /></AppLayout></ProtectedRoute>} />
        <Route path="/materials" element={<ProtectedRoute><AppLayout><Materials /></AppLayout></ProtectedRoute>} />
        <Route path="/my-uploads" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><AppLayout><MyUploads /></AppLayout></RoleProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
        <Route path="/material/:id" element={<ProtectedRoute><AppLayout><MaterialView /></AppLayout></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute><AppLayout><ProjectView /></AppLayout></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AppLayout><Admin /></AppLayout></ProtectedRoute>} />
        <Route path="/meta-analysis" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><AppLayout><MetaAnalysis /></AppLayout></RoleProtectedRoute>} />
        <Route path="/meta-comparison" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><AppLayout><MetaComparison /></AppLayout></RoleProtectedRoute>} />
        <Route path="/creative/:adId" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><AppLayout><CreativeDetail /></AppLayout></RoleProtectedRoute>} />
        <Route path="/briefing-editor/:briefingId" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><AppLayout><BriefingEditor /></AppLayout></RoleProtectedRoute>} />
        <Route path="/taxonomy-assistant" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><AppLayout><TaxonomyAssistant /></AppLayout></RoleProtectedRoute>} />
        <Route path="/document-editor/:id" element={<RoleProtectedRoute allowedRoles={['admin', 'collaborator']}><DocumentEditor /></RoleProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MaterialsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </MaterialsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
