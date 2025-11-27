import { Home, FileText, Settings, Upload, User, Brain, Tags, LogOut, SunMoon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CircularSideMenu } from "@/components/ui/side-menu-circular";
import { useState, useEffect } from "react";

export function AppSideMenu({ onExpandChange }: { onExpandChange?: (expanded: boolean) => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setTheme(savedTheme);
    }
  }, []);

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    root.classList.remove('dark');
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
    }
    
    localStorage.setItem('theme', newTheme);
  };

  const cycleTheme = () => {
    const nextTheme: 'light' | 'dark' = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const allItems = [
    { 
      label: "Painel", 
      icon: <Home size={20} />,
      onClick: () => navigate('/'),
      active: location.pathname === '/'
    },
    { 
      label: "Materiais", 
      icon: <FileText size={20} />,
      onClick: () => navigate('/materials'),
      active: location.pathname === '/materials'
    },
    ...(profile?.role !== 'client' ? [
      { 
        label: "Creative Analysis AI", 
        icon: <Brain size={20} />,
        onClick: () => navigate('/meta-analysis'),
        active: location.pathname === '/meta-analysis'
      },
      { 
        label: "Taxonomia", 
        icon: <Tags size={20} />,
        onClick: () => navigate('/taxonomy-assistant'),
        active: location.pathname === '/taxonomy-assistant'
      },
      { 
        label: "Meus Uploads", 
        icon: <Upload size={20} />,
        onClick: () => navigate('/my-uploads'),
        active: location.pathname === '/my-uploads'
      }
    ] : []),
    { 
      label: "Tema", 
      icon: <SunMoon size={20} />,
      onClick: cycleTheme
    },
    ...(profile?.role === 'admin' ? [
      { 
        label: "Admin", 
        icon: <Settings size={20} />,
        onClick: () => navigate('/admin'),
        active: location.pathname === '/admin'
      }
    ] : []),
    { 
      label: "Perfil", 
      icon: <User size={20} />,
      onClick: () => navigate('/profile'),
      active: location.pathname === '/profile'
    },
    { 
      label: "Sair", 
      icon: <LogOut size={20} />,
      onClick: signOut
    }
  ];

  return (
    <CircularSideMenu 
      items={allItems}
      expandable={true}
      defaultExpanded={false}
      onExpandChange={onExpandChange}
    />
  );
}
