import { Upload, Search, Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadModal } from "@/components/UploadModal";
import { ProfileModal } from "@/components/ProfileModal";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMaterials } from "@/contexts/MaterialsContext";
import { useUsernameCheck } from "@/hooks/useUsernameCheck";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThinkMeoLogo } from "@/components/ThinkMeoLogo";

export const Header = () => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'purple'>('light');
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { notifyMaterialChange } = useMaterials();

  // Verificar se usuário precisa configurar username
  useUsernameCheck();

  useEffect(() => {
    // Verificar tema salvo no localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'purple';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const canUpload = profile?.role === 'admin' || profile?.role === 'collaborator';
  const userInitials = profile?.full_name
    ?.split(' ')
    .map(name => name[0])
    .join('')
    .toUpperCase() || 'U';

  const logoSrc = theme === 'purple'
    ? "/lovable-uploads/53109fc3-3276-4a32-a966-1394af63fc53.png"
    : "/lovable-uploads/792d77a5-6bf4-45e6-a3b2-a23638b3ce56.png";

  return (
    <header className="w-full">
      <div className="flex h-14 items-center justify-between gap-2 sm:gap-4">
        {/* Logo - Fixed width to prevent shifting */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0 ml-20">
          <img
            src={logoSrc}
            alt="Think Logo"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex-shrink-0"
          />
          <div className="hidden sm:block">
            <ThinkMeoLogo size="md" className="-ml-1" />
          </div>
        </div>

        {/* Search - Responsive width */}
        <div className="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-4">
          <div className="relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const searchTerm = formData.get('search') as string;
              if (searchTerm.trim()) {
                navigate(`/materials?search=${encodeURIComponent(searchTerm.trim())}`);
              }
            }}>
              <Input
                name="search"
                placeholder="Buscar..."
                className="pl-8 sm:pl-10 pr-2 h-8 sm:h-9 text-sm bg-accent/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </form>
          </div>
        </div>

        {/* Actions - Fixed width to prevent shifting */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {canUpload && (
            <Button
              size="sm"
              variant="outline"
              className="group relative bg-transparent border border-primary/20 hover:border-primary/40 rounded-xl transition-all duration-300 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] overflow-visible h-8 w-8 sm:w-auto sm:px-3 p-0 sm:p-2"
              onClick={() => setUploadModalOpen(true)}
              title="Upload Material"
            >
              <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden lg:block absolute right-full mr-2 max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out group-hover:max-w-[100px] group-hover:opacity-100 pointer-events-none">
                Upload
              </span>
            </Button>
          )}

          <NotificationCenter />

          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 flex-shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {profile?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {profile?.role === 'admin' ? 'Administrador' :
                      profile?.role === 'client' ? 'Cliente' : 'Colaborador'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowProfileModal(true)}
              >
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onMaterialUploaded={() => {
          notifyMaterialChange('created');
        }}
      />

      <ProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
      />
    </header>
  );
};