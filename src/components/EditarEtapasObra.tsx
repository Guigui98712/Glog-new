import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

interface EtapaItem {
  id: string;
  nome: string;
}

interface EditarEtapasObraProps {
  obraId: number;
  onClose: () => void;
  onSave: () => void;
}

const EditarEtapasObra: React.FC<EditarEtapasObraProps> = ({ obraId, onClose, onSave }) => {
  const { toast } = useToast();
  const [etapas, setEtapas] = useState<EtapaItem[]>([]);
  const [novaEtapaNome, setNovaEtapaNome] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarEtapas();
  }, [obraId]);

  const carregarEtapas = async () => {
    try {
      setLoading(true);

      const { data: etapasDatas, error } = await supabase
        .from('etapas_fluxograma')
        .select('*')
        .eq('obra_id', obraId);

      if (error) {
        throw error;
      }

      if (etapasDatas && etapasDatas.length > 0) {
        const itens = etapasDatas.map((etapa: any) => ({
          id: etapa.id.toString(),
          nome: etapa.nome as string,
        }));
        setEtapas(itens);
      } else {
        // fallback simples caso não existam etapas salvas
        const etapasPadrao = [
          'Serviços Preliminares',
          'Terraplenagem',
          'Fundação',
          'Alvenaria',
          'Estrutura',
          'Passagens Elétricas',
          'Passagens Hidráulicas',
          'Laje',
          'Cobertura',
          'Instalações Elétricas',
          'Instalações Hidráulicas',
          'Reboco',
          'Regularização',
          'Revestimento',
          'Gesso',
          'Marmoraria',
          'Pintura',
          'Esquadrias',
          'Limpeza Bruta',
          'Marcenaria',
          'Metais',
          'Limpeza Final',
        ];

        setEtapas(
          etapasPadrao.map((nome, index) => ({
            id: `padrao-${index + 1}`,
            nome,
          })),
        );
      }
    } catch (error) {
      console.error('Erro ao carregar etapas:', error);
      toast({
        title: 'Erro ao carregar etapas',
        description: 'Não foi possível carregar as etapas da obra.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEtapa = () => {
    if (!novaEtapaNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para a nova etapa.',
        variant: 'destructive',
      });
      return;
    }

    const novaEtapa: EtapaItem = {
      id: `nova-${Date.now()}`,
      nome: novaEtapaNome.trim(),
    };

    setEtapas((prev) => [...prev, novaEtapa]);
    setNovaEtapaNome('');
  };

  const handleStartEdit = (etapa: EtapaItem) => {
    setEditingId(etapa.id);
    setEditingNome(etapa.nome);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingNome('');
  };

  const handleConfirmEdit = () => {
    if (!editingId) return;
    if (!editingNome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe um nome para a etapa.',
        variant: 'destructive',
      });
      return;
    }

    setEtapas((prev) =>
      prev.map((etapa) =>
        etapa.id === editingId ? { ...etapa, nome: editingNome.trim() } : etapa,
      ),
    );
    setEditingId(null);
    setEditingNome('');
  };

  const handleDeleteLocal = (id: string) => {
    setEtapas((prev) => prev.filter((etapa) => etapa.id !== id));
  };

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    setEtapas((prev) => {
      const novo = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= novo.length) return prev;
      const temp = novo[index];
      novo[index] = novo[targetIndex];
      novo[targetIndex] = temp;
      return novo;
    });
  };

  const handleSaveEtapas = async () => {
    try {
      setSalvando(true);

      // Apaga todas as etapas salvas para a obra
      const { error: deleteError } = await supabase
        .from('etapas_fluxograma')
        .delete()
        .eq('obra_id', obraId);

      if (deleteError) {
        throw deleteError;
      }

      // Insere novamente na ordem atual
      const etapasParaInserir = etapas.map((etapa, index) => ({
        obra_id: obraId,
        nome: etapa.nome,
        // posição padrão em linha (mantém compatibilidade, mesmo sem usarmos o fluxograma)
        position: { x: index * 200, y: 0 },
      }));

      const { error: insertError } = await supabase
        .from('etapas_fluxograma')
        .insert(etapasParaInserir);

      if (insertError) {
        throw insertError;
      }

      // Mantém compatibilidade com tabela etapas_datas
      const { error: deleteEtapasDatasError } = await supabase
        .from('etapas_datas')
        .delete()
        .eq('obra_id', obraId);

      if (deleteEtapasDatasError) {
        throw deleteEtapasDatasError;
      }

      const etapasDatasParaInserir = etapas.map((etapa) => ({
        obra_id: obraId,
        etapa_nome: etapa.nome,
        status: 'pendente',
      }));

      const { error: insertEtapasDatasError } = await supabase
        .from('etapas_datas')
        .insert(etapasDatasParaInserir);

      if (insertEtapasDatasError) {
        throw insertEtapasDatasError;
      }

      toast({
        title: 'Etapas salvas',
        description: 'As etapas da obra foram atualizadas com sucesso.',
      });

      onSave();
    } catch (error) {
      console.error('Erro ao salvar etapas:', error);
      toast({
        title: 'Erro ao salvar etapas',
        description: 'Não foi possível salvar as etapas da obra.',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-base sm:text-lg">Etapas da Obra</span>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEtapas}
              disabled={salvando || etapas.length === 0}
              className="w-full sm:w-auto"
            >
              {salvando ? 'Salvando...' : 'Salvar Etapas'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Lista de etapas</Label>
          {etapas.length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma etapa cadastrada ainda.</p>
          )}
          <div className="space-y-2">
            {etapas.map((etapa, index) => {
              const isEditing = editingId === etapa.id;
              return (
                <div
                  key={etapa.id}
                  className="flex flex-col gap-2 border rounded-md px-3 py-2 bg-white sm:flex-row sm:items-center"
                >
                  <span className="text-xs text-gray-400 sm:w-6">{index + 1}.</span>
                  {isEditing ? (
                    <Input
                      value={editingNome}
                      onChange={(e) => setEditingNome(e.target.value)}
                      className="flex-1 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm truncate">{etapa.nome}</span>
                  )}
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReorder(index, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReorder(index, 'down')}
                        disabled={index === etapas.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleConfirmEdit}
                          disabled={!editingNome.trim()}
                        >
                          Salvar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(etapa)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteLocal(etapa.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="nova-etapa" className="text-sm font-medium">
            Adicionar nova etapa
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="nova-etapa"
              placeholder="Nome da nova etapa (ex: Fundação)"
              value={novaEtapaNome}
              onChange={(e) => setNovaEtapaNome(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddEtapa} disabled={!novaEtapaNome.trim()}>
              Adicionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EditarEtapasObra;

