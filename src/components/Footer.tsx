import { ThinkMeoLogo } from "@/components/ThinkMeoLogo";

export const Footer = () => {
  return (
    <footer className="mt-16 border-t border-border/40">
      {/* Gradient Line */}
      <div className="h-[2px] bg-gradient-to-r from-[#6A00FF] via-[#00B8FF] to-transparent" />

      {/* Think Meo Brand Mark */}
      <div className="container mx-auto px-4 py-6 flex justify-end">
        <ThinkMeoLogo size="sm" />
      </div>
    </footer>
  );
};
