import { cn } from "@/lib/utils";

interface ThinkMeoLogoProps {
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
}

export const ThinkMeoLogo = ({ className, size = "md" }: ThinkMeoLogoProps) => {
    const sizeClasses = {
        sm: "text-lg",
        md: "text-2xl",
        lg: "text-3xl",
        xl: "text-4xl",
    };

    return (
        <div className={cn("font-brand inline-flex items-center", sizeClasses[size], className)}>
            <span className="font-extrabold text-foreground">think•</span>
            <span className="font-light text-foreground">meo</span>
        </div>
    );
};
