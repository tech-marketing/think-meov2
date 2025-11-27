import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
}

export const Logo = ({ className, size = "md" }: LogoProps) => {
    const sizeClasses = {
        sm: "text-xl",
        md: "text-3xl",
        lg: "text-4xl",
        xl: "text-5xl",
    };

    return (
        <div className={cn("font-montserrat tracking-tight select-none", sizeClasses[size], className)}>
            <span className="font-extrabold">think</span>
            <span className="text-primary mx-0.5">•</span>
            <span className="font-light">meo</span>
        </div>
    );
};
