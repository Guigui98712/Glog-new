import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { FileDown, FileUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjetoService, Projeto } from '@/services/ProjetoService';
import { toast } from '@/components/ui/use-toast';

export default function Projetos() {
  const { id: obraId } = useParams();
  const [projetosDWG, setProjetosDWG] = useState<Projeto[]>([]);
  const [projetosREVIT, setProjetosREVIT] = useState<Projeto[]>([]);
  const [projetosPDF, setProjetosPDF] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projetoService = new ProjetoService();

  const carregarProjetos = async () => {
    if (!obraId) return;
    
    try {
      setLoading(true);
      const [dwg, revit, pdf] = await Promise.all([
        projetoService.buscarProjetos('DWG', obraId),
        projetoService.buscarProjetos('REVIT', obraId),
        projetoService.buscarProjetos('PDF', obraId)
      ]);

      setProjetosDWG(dwg);
      setProjetosREVIT(revit);
      setProjetosPDF(pdf);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar projetos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!obraId) {
      toast({
        title: "Erro",
        description: "ID da obra não fornecido",
        variant: "destructive"
      });
      return;
    }
    carregarProjetos();
  }, [obraId]);

  const handleUpload = async (tipo: string) => {
    if (!fileInputRef.current || !obraId) return;
    
    fileInputRef.current.accept = tipo === 'DWG' ? '.dwg' :
                                 tipo === 'REVIT' ? '.rvt' :
                                 '.pdf';
    fileInputRef.current.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !obraId) return;

    try {
      setLoading(true);
      const tipo = file.name.split('.').pop()?.toUpperCase() || '';
      await projetoService.uploadProjeto(file, tipo, obraId);
      await carregarProjetos();
      toast({
        title: "Sucesso",
        description: "Projeto enviado com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do projeto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (url: string, nome: string) => {
    try {
      setLoading(true);
      const blob = await projetoService.downloadProjeto(url);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer download do projeto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, tipo: string) => {
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return;

    try {
      setLoading(true);
      await projetoService.excluirProjeto(id);
      await carregarProjetos();
      toast({
        title: "Sucesso",
        description: "Projeto excluído com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir projeto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const ProjetosList = ({ projetos, tipo }: { projetos: Projeto[], tipo: string }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Projetos {tipo}</h3>
        <Button 
          onClick={() => handleUpload(tipo)} 
          className="flex items-center gap-2"
          disabled={loading}
        >
          <FileUp size={16} />
          Upload
        </Button>
      </div>
      <div className="grid gap-4">
        {projetos.map((projeto) => (
          <Card key={projeto.id}>
            <CardHeader className="p-4">
              <CardTitle className="text-base flex justify-between items-center">
                <span>{projeto.nome}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(projeto.url, projeto.nome)}
                    disabled={loading}
                  >
                    <FileDown size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(projeto.id, tipo)}
                    disabled={loading}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-gray-500">
              Enviado em: {new Date(projeto.dataUpload).toLocaleDateString()}
            </CardContent>
          </Card>
        ))}
        {projetos.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum projeto {tipo} encontrado
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Projetos</h1>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <Tabs defaultValue="dwg" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dwg">DWG</TabsTrigger>
          <TabsTrigger value="revit">REVIT</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="dwg">
          <ProjetosList projetos={projetosDWG} tipo="DWG" />
        </TabsContent>
        <TabsContent value="revit">
          <ProjetosList projetos={projetosREVIT} tipo="REVIT" />
        </TabsContent>
        <TabsContent value="pdf">
          <ProjetosList projetos={projetosPDF} tipo="PDF" />
        </TabsContent>
      </Tabs>
    </div>
  );
} 