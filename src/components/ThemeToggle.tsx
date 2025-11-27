import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  variant?: 'default' | 'white';
}

export const ThemeToggle = ({ variant = 'default' }: ThemeToggleProps) => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove('dark');
    if (newTheme === 'dark') {
      root.classList.add('dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  const cycleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const getIcon = () => {
    const iconClass = variant === 'white' ? 'h-4 w-4 text-white' : 'h-4 w-4';
    return theme === 'light' ? <Sun className={iconClass} /> : <Moon className={iconClass} />;
  };

  const buttonClass = variant === 'white'
    ? "h-8 w-8 p-0 hover:bg-white/20 transition-all duration-200 text-white"
    : "h-8 w-8 p-0 hover:bg-accent/50 transition-all duration-200";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className={buttonClass}
      title={`Tema atual: ${theme === 'light' ? 'Claro' : 'Escuro'}`}
    >
      {getIcon()}
    </Button>
  );
};
