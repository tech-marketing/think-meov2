
import { AdminPanel } from "@/components/AdminPanel";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const Admin = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only admins can access this page
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <AdminPanel />;
};

export default Admin;