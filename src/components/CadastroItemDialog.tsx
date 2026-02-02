import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createItem } from '@/lib/api';

const categorias = [
  "Alvenaria",
  "Estrutura",
  "Hidráulica",
  "Elétrica",
  "Ferramentas",
  "EPIs",
  "Geral"
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  obraId: number;
};

const CadastroItemDialog: React.FC<Props> = ({ open, onOpenChange, onCreated, obraId }) => {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [categoria, setCategoria] = useState('');
  const [quantidade, setQuantidade] = useState<number>(0);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!nome.trim()) return toast({ title: 'Erro', description: 'Digite o nome do item', variant: 'destructive' });
    setLoading(true);
    try {
      await createItem({ nome: nome.trim(), unidade: unidade || 'un', categoria: categoria || null, quantidade: quantidade || 0, obra_id: obraId });
      toast({ title: 'Criado', description: 'Item cadastrado com sucesso' });
      setNome(''); setUnidade('un'); setCategoria(''); setQuantidade(0);
      onCreated && onCreated();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao criar item', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select onValueChange={setCategoria} value={categoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade inicial</Label>
            <Input type="number" value={quantidade.toString()} onChange={(e) => setQuantidade(Number(e.target.value || 0))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CadastroItemDialog;
