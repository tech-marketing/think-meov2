import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface HoverPreviewProps {
    type: 'image' | 'video' | 'carousel';
    fileUrl?: string;
    className?: string;
    isHovered: boolean;
}

export const HoverPreview = ({ type, fileUrl, className, isHovered }: HoverPreviewProps) => {
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [slides, setSlides] = useState<string[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Parse carousel URLs
    useEffect(() => {
        if (type === 'carousel' && fileUrl) {
            try {
                const parsed = JSON.parse(fileUrl);
                if (Array.isArray(parsed)) {
                    setSlides(parsed);
                }
            } catch {
                // Not a JSON array, might be a single URL
                if (fileUrl) {
                    setSlides([fileUrl]);
                }
            }
        }
    }, [type, fileUrl]);

    // Handle carousel auto-cycling on hover
    useEffect(() => {
        if (type === 'carousel' && isHovered && slides.length > 1) {
            intervalRef.current = setInterval(() => {
                setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
            }, 1000); // Change slide every 1 second

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setCurrentSlideIndex(0);
        }
    }, [isHovered, slides.length, type]);

    // Handle video playback on hover
    useEffect(() => {
        if (type === 'video' && videoRef.current) {
            if (isHovered) {
                videoRef.current.play().catch(() => {
                    // Autoplay might be blocked by browser
                });
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }
    }, [isHovered, type]);

    if (!fileUrl) return null;

    if (type === 'video') {
        return (
            <div className={cn("absolute inset-0 rounded-lg overflow-hidden", className)}>
                <video
                    ref={videoRef}
                    src={fileUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                />
            </div>
        );
    }

    if (type === 'carousel' && slides.length > 0) {
        return (
            <div className={cn("absolute inset-0 rounded-lg overflow-hidden", className)}>
                <img
                    src={slides[currentSlideIndex]}
                    alt={`Slide ${currentSlideIndex + 1}`}
                    className="w-full h-full object-cover"
                />
                {slides.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {slides.map((_, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all",
                                    index === currentSlideIndex ? "bg-white w-3" : "bg-white/50"
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (type === 'image') {
        return (
            <div className={cn("absolute inset-0 rounded-lg overflow-hidden", className)}>
                <img
                    src={fileUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    return null;
};
