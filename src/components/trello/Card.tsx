import { useState, useEffect } from 'react';
import { Card as CardUI, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { TrelloCard, TrelloChecklist, TrelloChecklistItem, TrelloLabel } from '@/types/trello';
import { criarChecklist, adicionarItemChecklist, atualizarItemChecklist, excluirItemChecklist, excluirChecklist } from '@/lib/trello-local';
import { CardChecklist } from './CardChecklist';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CardExpanded } from './CardExpanded';

interface CardProps {
  card: TrelloCard;
  onDelete: (cardId: number) => void;
  onUpdate: (cardId: number, updates: Partial<TrelloCard>) => void;
  onAddChecklist: (cardId: number, title: string) => Promise<void>;
  onAddComment: (cardId: number, content: string) => Promise<void>;
  onAddAttachment: (cardId: number, file: File) => Promise<void>;
  onToggleLabel: (cardId: number, labelId: number) => Promise<void>;
  availableLabels: TrelloLabel[];
}

export function Card({
  card,
  onDelete,
  onUpdate,
  onAddChecklist,
  onAddComment,
  onAddAttachment,
  onToggleLabel,
  availableLabels
}: CardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [showExpanded, setShowExpanded] = useState(false);

  useEffect(() => {
    console.log('[DEBUG] Card atualizado:', card);
    console.log('[DEBUG] Etiquetas do card:', card.labels);
  }, [card]);

  const handleSave = () => {
    onUpdate(card.id, { title });
    setIsEditing(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isEditing) {
      setShowExpanded(true);
    }
  };

  const handleToggleLabel = async (labelId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Impedir que o card seja expandido
    console.log('[DEBUG] Clique na etiqueta:', labelId);
    try {
      await onToggleLabel(card.id, labelId);
    } catch (error) {
      console.error('[DEBUG] Erro ao alternar etiqueta:', error);
      toast({
        title: "Erro",
        description: "Erro ao alternar etiqueta",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <CardUI 
        className="mb-2 cursor-pointer hover:shadow-md transition-shadow"
        onClick={handleClick}
      >
        <CardContent className="p-4">
          {/* Etiquetas */}
          {card.labels && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {card.labels.map((label) => (
                <Badge
                  key={label.id}
                  style={{ 
                    backgroundColor: label.color,
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => handleToggleLabel(label.id, e)}
                >
                  {label.title}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSave}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <div onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}>
                  {title}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Indicadores */}
          <div className="flex gap-2 mt-2 text-xs text-gray-500">
            {card.checklists.length > 0 && (
              <div>
                {card.checklists.reduce((total, cl) => 
                  total + cl.items.filter(item => item.checked).length, 0
                )}/
                {card.checklists.reduce((total, cl) => total + cl.items.length, 0)} itens
              </div>
            )}
            {card.comments.length > 0 && (
              <div>{card.comments.length} comentários</div>
            )}
            {card.attachments.length > 0 && (
              <div>{card.attachments.length} anexos</div>
            )}
          </div>
        </CardContent>
      </CardUI>

      <CardExpanded
        card={card}
        open={showExpanded}
        onOpenChange={setShowExpanded}
        onUpdate={onUpdate}
        onAddChecklist={onAddChecklist}
        onAddComment={onAddComment}
        onAddAttachment={onAddAttachment}
        onToggleLabel={onToggleLabel}
        availableLabels={availableLabels}
      />
    </>
  );
} 