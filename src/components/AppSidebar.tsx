import { useState } from "react";
import { Home, FileText, Settings, Upload, User, Brain, Tags } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppSidebar() {
  const { state } = useSidebar();
  const { profile } = useAuth();
  const location = useLocation();

  const items = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Materiais", url: "/materials", icon: FileText },
    ...(profile?.role !== 'client' ? [{ title: "Creative Analysis AI", url: "/meta-analysis", icon: Brain }] : []),
    ...(profile?.role !== 'client' ? [{ title: "Taxonomia", url: "/taxonomy-assistant", icon: Tags }] : []),
    ...(profile?.role !== 'client' ? [{ title: "Meus Uploads", url: "/my-uploads", icon: Upload }] : []),
    ...(profile?.role === 'admin' ? [{ title: "Admin", url: "/admin", icon: Settings }] : []),
    { title: "Perfil", url: "/profile", icon: User },
  ];

  const isActive = (path: string) => location.pathname === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50";

  return (
    <TooltipProvider>
      <Sidebar
        className="transition-all duration-300 ease-in-out"
        collapsible="icon"
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>
              <span className="invisible">Navegação</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {state === "collapsed" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.url} className={getNavCls}>
                              <item.icon className="h-4 w-4" />
                            </NavLink>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p>{item.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        {/* Theme Toggle na parte inferior */}
        <div className={`mt-auto p-4 ${state === "collapsed" ? "p-2" : ""}`}>
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
    </TooltipProvider>
  );
}