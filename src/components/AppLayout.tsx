import { AppSideMenu } from "@/components/AppSideMenu";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SupportButton } from "@/components/SupportButton";
import { useState } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);

  const getMainPadding = () => {
    if (typeof window === 'undefined') return '0';
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) return '64px';
    return isMenuExpanded ? '260px' : '88px';
  };

  return (
    <div className="min-h-screen flex w-full relative bg-gradient-to-br from-[#6E50FF]/5 via-[#8B7FFF]/5 to-[#A78BFA]/5 dark:from-[#1a0b2e] dark:via-[#2d1b4e] dark:to-[#3d2b5e]">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl" />
      <div className="relative flex w-full">
        <AppSideMenu onExpandChange={setIsMenuExpanded} />
        
        <div className="flex-1 flex flex-col w-full">
          <div className="sticky top-0 z-40 flex items-center h-14 px-3 sm:px-6 bg-background/95 backdrop-blur border-b border-border/40">
            <Header />
          </div>
          
          <main 
            className="flex-1 overflow-auto transition-all duration-300"
            style={{ paddingLeft: getMainPadding() }}
          >
            <div className="min-h-full flex flex-col py-4 px-3 sm:py-6 sm:px-6">
              <div className="flex-1">
                {children}
              </div>
              <Footer />
            </div>
          </main>
        </div>
        
        <SupportButton />
      </div>
    </div>
  );
}