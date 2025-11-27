import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { PlayCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
interface VideoPlayerWithCaptionProps {
  videoUrl: string;
  caption?: string;
  thumbnailUrl?: string;
}
export const VideoPlayerWithCaption = ({
  videoUrl,
  caption,
  thumbnailUrl
}: VideoPlayerWithCaptionProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = 'video-gerado.mp4';
    link.click();
  };
  return <div className="space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <div className="relative group rounded-lg overflow-hidden cursor-pointer w-full aspect-video bg-black">
            {thumbnailUrl ? <img src={thumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <video src={videoUrl} className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <PlayCircle className="h-20 w-20 text-white/90 transform transition-all duration-300 group-hover:scale-110 drop-shadow-lg" />
            </div>
          </div>
        </DialogTrigger>
        
        <DialogContent className="max-w-5xl p-0 border-0">
          <div className="bg-black">
            <video src={videoUrl} controls autoPlay className="w-full aspect-video" />
          </div>
          
          {caption && <div className="p-6 bg-background space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  Legenda do Vídeo
                </h4>
                <p className="text-sm">{caption}</p>
              </div>
              
              <Button onClick={handleDownload} variant="outline" size="sm" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Baixar Vídeo (MP4)
              </Button>
            </div>}
        </DialogContent>
      </Dialog>
      
      {caption}
    </div>;
};