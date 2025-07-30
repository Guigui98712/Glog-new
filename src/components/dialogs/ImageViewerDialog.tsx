import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Download, RotateCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/components/ui/use-toast';

interface ImageViewerDialogProps {
  images: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export function ImageViewerDialog({ 
  images, 
  open, 
  onOpenChange, 
  title = "Visualizar Imagens" 
}: ImageViewerDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setImageError(false);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setImageError(false);
  };

  const handleDownload = async () => {
    if (!images[currentIndex]) return;

    try {
      setIsLoading(true);
      
      if (Capacitor.isNativePlatform()) {
        // Para dispositivos nativos, usar o Share API
        const { Share } = await import('@capacitor/share');
        
        // Fazer download da imagem
        const response = await fetch(images[currentIndex]);
        const blob = await response.blob();
        
        // Converter para base64
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (base64) resolve(base64);
            else reject(new Error('Erro ao converter imagem'));
          };
          reader.readAsDataURL(blob);
        });

        // Compartilhar a imagem
        await Share.share({
          title: `Imagem ${currentIndex + 1}`,
          text: 'Imagem do diário de obra',
          files: [base64Data],
          dialogTitle: 'Salvar imagem'
        });
      } else {
        // Para web, fazer download direto
        const response = await fetch(images[currentIndex]);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `imagem_${currentIndex + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: "Sucesso",
        description: "Imagem salva com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao baixar imagem:', error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar a imagem",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = () => {
    setImageError(true);
    console.error('Erro ao carregar imagem:', images[currentIndex]);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <DialogHeader className="flex flex-row items-center justify-between p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {title}
            <span className="text-sm text-muted-foreground">
              ({currentIndex + 1} de {images.length})
            </span>
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="relative flex-1 flex items-center justify-center bg-black/5 min-h-[60vh]">
          {/* Botão Anterior */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Imagem Principal */}
          <div className="relative max-w-full max-h-full flex items-center justify-center p-4">
            {imageError ? (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <RotateCw className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Erro ao carregar a imagem
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImageError(false);
                    // Forçar recarregamento da imagem
                    const img = document.querySelector(`#image-${currentIndex}`) as HTMLImageElement;
                    if (img) {
                      img.src = '';
                      setTimeout(() => {
                        img.src = images[currentIndex];
                      }, 100);
                    }
                  }}
                >
                  Tentar Novamente
                </Button>
              </div>
            ) : (
              <img
                id={`image-${currentIndex}`}
                src={images[currentIndex]}
                alt={`Imagem ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                onError={handleImageError}
                onLoad={handleImageLoad}
                style={{ maxHeight: '70vh' }}
              />
            )}
          </div>

          {/* Botão Próximo */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* Controles Inferiores */}
        <div className="flex items-center justify-between p-4 border-t bg-background">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading || imageError}
            >
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? 'Baixando...' : 'Baixar'}
            </Button>
          </div>

          {/* Indicadores de Navegação */}
          {images.length > 1 && (
            <div className="flex items-center gap-1">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    setImageError(false);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex 
                      ? 'bg-primary' 
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 