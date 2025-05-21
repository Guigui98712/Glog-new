import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileDown, FileUp, Trash2, AlertCircle, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjetoService, Projeto } from '@/services/ProjetoService';
import { toast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Capacitor } from '@capacitor/core';

export default function Projetos() {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const [projetosDWG, setProjetosDWG] = useState<Projeto[]>([]);
  const [projetosREVIT, setProjetosREVIT] = useState<Projeto[]>([]);
  const [projetosPDF, setProjetosPDF] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projetoService = new ProjetoService();

  const carregarProjetos = async () => {
    if (!obraId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Carregando projetos para a obra:', obraId);
      const [dwg, revit, pdf] = await Promise.all([
        projetoService.buscarProjetos('DWG', obraId),
        projetoService.buscarProjetos('REVIT', obraId),
        projetoService.buscarProjetos('PDF', obraId)
      ]);

      console.log(`Projetos carregados - DWG: ${dwg.length}, REVIT: ${revit.length}, PDF: ${pdf.length}`);
      
      setProjetosDWG(dwg);
      setProjetosREVIT(revit);
      setProjetosPDF(pdf);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao carregar projetos';
      setError(mensagem);
      toast({
        title: "Erro",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!obraId) {
      const mensagem = "ID da obra não fornecido";
      setError(mensagem);
      toast({
        title: "Erro",
        description: mensagem,
        variant: "destructive"
      });
      navigate('/obras');
      return;
    }
    carregarProjetos();
  }, [obraId, navigate]);

  const handleUpload = async (tipo: string) => {
    if (!fileInputRef.current || !obraId) return;

    setUploadTipo(tipo);

    // Configura para aceitar todos os tipos permitidos, independente da aba
    fileInputRef.current.accept = '.dwg,.rvt,.rfa,.pdf';
    fileInputRef.current.click();
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        // Progresso vai até 90% e o restante quando a operação concluir
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 10;
      });
    }, 500);
    
    return () => clearInterval(interval);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !obraId) return;

    try {
      setUploading(true);
      setError(null);

      // Iniciar animação de progresso
      const stopProgress = simulateProgress();

      // O 'tipo' vem do estado 'uploadTipo', definido quando o botão Upload foi clicado
      let tipo = uploadTipo;

      console.log(`Iniciando upload - Arquivo: ${file.name}, Categoria: ${tipo}, Tamanho: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

      await projetoService.uploadProjeto(file, tipo, obraId);

      // Completa o progresso
      setUploadProgress(100);

      // Pequeno delay para mostrar 100% antes de recarregar
      setTimeout(() => {
        stopProgress();
        setUploadProgress(0);
        carregarProjetos();
        toast({
          title: "Sucesso",
          description: `${file.name} enviado para a categoria ${tipo} com sucesso` // Mensagem ajustada
        });
      }, 500);

    } catch (error) {
      console.error('Erro ao fazer upload do projeto:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao fazer upload';
      setError(mensagem);
      toast({
        title: "Erro no Upload",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (url: string, nome: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Iniciando download de ${nome} - URL: ${url}`);
      
      if (Capacitor.isNativePlatform()) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');
          
          // Notificar início do download
          toast({
            title: "Download iniciado",
            description: `Baixando: ${nome}...`
          });
          
          // Fazer download do arquivo
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Erro ao baixar arquivo (${response.status})`);
          }
          
          const blob = await response.blob();
          const reader = new FileReader();
          
          // Converter blob para base64
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = reader.result?.toString().split(',')[1];
              if (base64) resolve(base64);
              else reject(new Error('Erro ao converter arquivo para base64'));
            };
            reader.readAsDataURL(blob);
          });
          
          // Determinar o diretório de salvamento
          // Salvar arquivo localmente
          const result = await Filesystem.writeFile({
            path: nome,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
          });
          
          console.log('Arquivo salvo localmente:', result.uri);
          
          toast({
            title: "Download concluído",
            description: `${nome} baixado com sucesso`
          });
          
          // Perguntar ao usuário se deseja abrir o arquivo
          const confirm = window.confirm(`Deseja abrir o arquivo ${nome}?`);
          
          if (confirm) {
            // Tentar compartilhar o arquivo, que permite ao usuário escolher qual app usar para abri-lo
            await Share.share({
              title: nome,
              url: result.uri,
              dialogTitle: 'Abrir com'
            });
          }
        } catch (error) {
          console.error('Erro ao baixar/abrir arquivo nativo:', error);
          throw error;
        }
      } else {
        // Em ambiente web, manter o comportamento atual
        const blob = await projetoService.downloadProjeto(url);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        toast({
          title: "Download iniciado",
          description: `Arquivo: ${nome}`
        });
      }
    } catch (error) {
      console.error('Erro ao fazer download do projeto:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao baixar arquivo';
      setError(mensagem);
      toast({
        title: "Erro no Download",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, tipo: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o projeto "${nome}"?`)) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log(`Excluindo projeto ${nome} (ID: ${id})`);
      
      await projetoService.excluirProjeto(id);
      await carregarProjetos();
      
      toast({
        title: "Sucesso",
        description: `${nome} excluído com sucesso`
      });
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao excluir projeto';
      setError(mensagem);
      toast({
        title: "Erro ao Excluir",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (url: string, nome: string) => {
    try {
      console.log(`Abrindo arquivo ${nome} - URL: ${url}`);
      
      if (Capacitor.isNativePlatform()) {
        // Mostrar indicador de carregamento
        setLoading(true);
        
        try {
          // Baixar o arquivo temporariamente para poder abri-lo com apps nativos
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');
          
          toast({
            title: "Preparando arquivo",
            description: `Carregando: ${nome}...`
          });
          
          // Fazer download do arquivo
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Erro ao carregar arquivo (${response.status})`);
          }
          
          const blob = await response.blob();
          const reader = new FileReader();
          
          // Converter blob para base64
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = reader.result?.toString().split(',')[1];
              if (base64) resolve(base64);
              else reject(new Error('Erro ao converter arquivo para base64'));
            };
            reader.readAsDataURL(blob);
          });
          
          // Salvar arquivo temporariamente
          const result = await Filesystem.writeFile({
            path: nome,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
          });
          
          console.log('Arquivo temporário salvo:', result.uri);
          
          // Abrir com o visualizador apropriado usando o Share API
          await Share.share({
            title: nome,
            url: result.uri,
            dialogTitle: 'Abrir com'
          });
          
          toast({
            title: "Arquivo Aberto",
            description: `${nome} aberto com sucesso`
          });
        } catch (error) {
          console.error('Erro ao abrir arquivo nativo:', error);
          throw error;
        } finally {
          setLoading(false);
        }
      } else {
        // Comportamento para web - abrir em nova aba
        window.open(url, '_blank');
        
        toast({
          title: "Arquivo Aberto",
          description: `Abrindo: ${nome}`
        });
      }
    } catch (error) {
      console.error('Erro ao abrir arquivo:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao abrir arquivo';
      setError(mensagem);
      toast({
        title: "Erro ao Abrir",
        description: mensagem,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const ProjetosList = ({ projetos, tipo }: { projetos: Projeto[], tipo: string }) => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <h3 className="text-base sm:text-lg font-semibold mb-2 sm:mb-0">Projetos {tipo}</h3>
        <Button 
          onClick={() => handleUpload(tipo)} 
          className="w-full sm:w-auto flex items-center gap-2"
          disabled={loading || uploading}
        >
          <FileUp size={16} />
          Upload
        </Button>
      </div>
      
      {uploading && uploadTipo === tipo && (
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm">Enviando arquivo...</span>
            <span className="text-sm">{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projetos.map((projeto) => (
          <Card key={projeto.id} className="w-full">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
                <span className="truncate text-center sm:text-left w-full">{projeto.nome}</span>
                <div className="flex gap-2 mt-2 sm:mt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenFile(projeto.url, projeto.nome)}
                    disabled={loading}
                    title="Abrir arquivo"
                    className="p-2"
                  >
                    <ExternalLink size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(projeto.url, projeto.nome)}
                    disabled={loading}
                    title="Baixar arquivo"
                    className="p-2"
                  >
                    <FileDown size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(projeto.id, tipo, projeto.nome)}
                    disabled={loading}
                    title="Excluir arquivo"
                    className="p-2"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm text-gray-500 text-center sm:text-left">
              Enviado em: {new Date(projeto.dataUpload).toLocaleDateString()}
            </CardContent>
          </Card>
        ))}
        {projetos.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-500">
            Nenhum projeto {tipo} encontrado
          </div>
        )}
      </div>
    </div>
  );

  const renderError = () => {
    if (!error) return null;
    
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-0">Projetos</h1>
        <Button 
          variant="outline" 
          className="w-full sm:w-auto"
          onClick={() => navigate(`/obras/${obraId}`)}
        >
          Voltar
        </Button>
      </div>
      
      {renderError()}
      
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      
      <Tabs defaultValue="dwg" className="space-y-4">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="dwg" className="flex-1">DWG</TabsTrigger>
          <TabsTrigger value="revit" className="flex-1">REVIT</TabsTrigger>
          <TabsTrigger value="pdf" className="flex-1">PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="dwg">
          <ProjetosList projetos={projetosDWG} tipo="DWG" />
          <p className="text-xs text-gray-500 mt-4 text-center sm:text-left">
            Arquivos categorizados como DWG (aceita .dwg, .rvt, .rfa, .pdf)
          </p>
        </TabsContent>
        <TabsContent value="revit">
          <ProjetosList projetos={projetosREVIT} tipo="REVIT" />
          <p className="text-xs text-gray-500 mt-4 text-center sm:text-left">
            Arquivos categorizados como REVIT (aceita .dwg, .rvt, .rfa, .pdf)
          </p>
        </TabsContent>
        <TabsContent value="pdf">
          <ProjetosList projetos={projetosPDF} tipo="PDF" />
          <p className="text-xs text-gray-500 mt-4 text-center sm:text-left">
            Arquivos categorizados como PDF (aceita .dwg, .rvt, .rfa, .pdf)
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
} 