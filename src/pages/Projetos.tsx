import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileDown, FileUp, Trash2, AlertCircle, Eye, ExternalLink, Share, Folder, FolderOpen, Plus, Edit, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjetoService, Projeto, Pasta } from '@/services/ProjetoService';
import { toast } from '@/components/ui/use-toast';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Capacitor } from '@capacitor/core';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function Projetos() {
  const { id: obraId } = useParams();
  const navigate = useNavigate();
  const [projetosDWG, setProjetosDWG] = useState<Projeto[]>([]);
  const [projetosREVIT, setProjetosREVIT] = useState<Projeto[]>([]);
  const [projetosPDF, setProjetosPDF] = useState<Projeto[]>([]);
  const [pastasDWG, setPastasDWG] = useState<Pasta[]>([]);
  const [pastasREVIT, setPastasREVIT] = useState<Pasta[]>([]);
  const [pastasPDF, setPastasPDF] = useState<Pasta[]>([]);
  const [pastaSelecionada, setPastaSelecionada] = useState<Pasta | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projetoService = new ProjetoService();

  // Estados para diálogos de pastas
  const [showCriarPastaDialog, setShowCriarPastaDialog] = useState(false);
  const [showRenomearPastaDialog, setShowRenomearPastaDialog] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState('');
  const [pastaParaRenomear, setPastaParaRenomear] = useState<Pasta | null>(null);
  const [novoNomePasta, setNovoNomePasta] = useState('');

  const carregarProjetos = async () => {
    if (!obraId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Carregando projetos para a obra:', obraId);
      const [dwg, revit, pdf] = await Promise.all([
        projetoService.buscarProjetosPorPasta('DWG', obraId, pastaSelecionada?.id),
        projetoService.buscarProjetosPorPasta('REVIT', obraId, pastaSelecionada?.id),
        projetoService.buscarProjetosPorPasta('PDF', obraId, pastaSelecionada?.id)
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

  const carregarPastas = async () => {
    if (!obraId) return;
    
    try {
      const [dwg, revit, pdf] = await Promise.all([
        projetoService.listarPastas('DWG', obraId),
        projetoService.listarPastas('REVIT', obraId),
        projetoService.listarPastas('PDF', obraId)
      ]);

      setPastasDWG(dwg);
      setPastasREVIT(revit);
      setPastasPDF(pdf);
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
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
    carregarPastas();
    carregarProjetos();
  }, [obraId, navigate, pastaSelecionada]);

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

      console.log(`Iniciando upload - Arquivo: ${file.name}, Categoria: ${tipo}, Pasta: ${pastaSelecionada?.nome || 'Raiz'}, Tamanho: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

      await projetoService.uploadProjeto(file, tipo, obraId, pastaSelecionada?.id);

      // Completa o progresso
      setUploadProgress(100);

      // Pequeno delay para mostrar 100% antes de recarregar
      setTimeout(() => {
        stopProgress();
        setUploadProgress(0);
        carregarProjetos();
        carregarPastas();
        toast({
          title: "Sucesso",
          description: `${file.name} enviado para ${pastaSelecionada ? `a pasta "${pastaSelecionada.nome}"` : 'a raiz'} com sucesso`
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

  // Funções para gerenciar pastas
  const handleCriarPasta = async () => {
    if (!novaPastaNome.trim() || !obraId) return;

    try {
      setLoading(true);
      await projetoService.criarPasta(novaPastaNome.trim(), uploadTipo, obraId);
      
      setNovaPastaNome('');
      setShowCriarPastaDialog(false);
      await carregarPastas();
      
      toast({
        title: "Sucesso",
        description: `Pasta "${novaPastaNome.trim()}" criada com sucesso`
      });
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao criar pasta';
      toast({
        title: "Erro ao Criar Pasta",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRenomearPasta = async () => {
    if (!pastaParaRenomear || !novoNomePasta.trim()) return;

    try {
      setLoading(true);
      await projetoService.renomearPasta(pastaParaRenomear.id, novoNomePasta.trim());
      
      setNovoNomePasta('');
      setPastaParaRenomear(null);
      setShowRenomearPastaDialog(false);
      await carregarPastas();
      
      // Se a pasta renomeada era a selecionada, atualizar o estado
      if (pastaSelecionada?.id === pastaParaRenomear.id) {
        setPastaSelecionada({ ...pastaSelecionada, nome: novoNomePasta.trim() });
      }
      
      toast({
        title: "Sucesso",
        description: `Pasta renomeada para "${novoNomePasta.trim()}"`
      });
    } catch (error) {
      console.error('Erro ao renomear pasta:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao renomear pasta';
      toast({
        title: "Erro ao Renomear Pasta",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirPasta = async (pasta: Pasta) => {
    if (!confirm(`Tem certeza que deseja excluir a pasta "${pasta.nome}"?`)) return;

    try {
      setLoading(true);
      await projetoService.excluirPasta(pasta.id);
      
      // Se a pasta excluída era a selecionada, voltar para a raiz
      if (pastaSelecionada?.id === pasta.id) {
        setPastaSelecionada(null);
      }
      
      await carregarPastas();
      await carregarProjetos();
      
      toast({
        title: "Sucesso",
        description: `Pasta "${pasta.nome}" excluída com sucesso`
      });
    } catch (error) {
      console.error('Erro ao excluir pasta:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao excluir pasta';
      toast({
        title: "Erro ao Excluir Pasta",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoltarParaRaiz = () => {
    setPastaSelecionada(null);
  };

  const handleSelecionarPasta = (pasta: Pasta) => {
    setPastaSelecionada(pasta);
  };

  const abrirDialogRenomearPasta = (pasta: Pasta) => {
    setPastaParaRenomear(pasta);
    setNovoNomePasta(pasta.nome);
    setShowRenomearPastaDialog(true);
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

  const handleShare = async (url: string, nome: string) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Iniciando compartilhamento de ${nome} - URL: ${url}`);
      
      if (Capacitor.isNativePlatform()) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share: ShareAPI } = await import('@capacitor/share');
          
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
          
          // Salvar arquivo em local permanente para compartilhamento
          const result = await Filesystem.writeFile({
            path: `projetos/${nome}`,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
          });
          
          console.log('Arquivo salvo para compartilhamento:', result.uri);
          
          // Compartilhar o arquivo
          await ShareAPI.share({
            title: nome,
            text: `Projeto: ${nome}`,
            url: result.uri,
            dialogTitle: 'Compartilhar projeto'
          });
          
          toast({
            title: "Compartilhamento iniciado",
            description: `${nome} pronto para compartilhar`
          });
        } catch (error) {
          console.error('Erro ao compartilhar arquivo nativo:', error);
          throw new Error(`Erro ao compartilhar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      } else {
        // Em ambiente web, tentar usar Web Share API se disponível
        if (navigator.share) {
          try {
            // Para web, baixar o arquivo primeiro
            const blob = await projetoService.downloadProjeto(url);
            const file = new File([blob], nome, { type: blob.type });
            
            await navigator.share({
              title: nome,
              text: `Projeto: ${nome}`,
              files: [file]
            });
            
            toast({
              title: "Compartilhamento iniciado",
              description: `${nome} compartilhado com sucesso`
            });
          } catch (shareError) {
            console.error('Erro no Web Share API:', shareError);
            // Fallback: abrir em nova aba
            window.open(url, '_blank');
            toast({
              title: "Arquivo aberto",
              description: `${nome} aberto em nova aba`
            });
          }
        } else {
          // Fallback para navegadores sem Web Share API
          window.open(url, '_blank');
          toast({
            title: "Arquivo aberto",
            description: `${nome} aberto em nova aba`
          });
        }
      }
    } catch (error) {
      console.error('Erro ao compartilhar projeto:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao compartilhar arquivo';
      setError(mensagem);
      toast({
        title: "Erro no Compartilhamento",
        description: mensagem,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const ProjetosList = ({ projetos, tipo }: { projetos: Projeto[], tipo: string }) => {
    const pastas = tipo === 'DWG' ? pastasDWG : tipo === 'REVIT' ? pastasREVIT : pastasPDF;
    
    return (
      <div className="space-y-4">
        {/* Navegação de pastas */}
        <div className="flex flex-col space-y-3">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Projetos {tipo}</span>
            {pastaSelecionada && (
              <>
                <span>/</span>
                <span className="font-medium text-gray-800">{pastaSelecionada.nome}</span>
              </>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              {pastaSelecionada && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVoltarParaRaiz}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Voltar à Raiz
                </Button>
              )}
              <Button 
                onClick={() => {
                  setUploadTipo(tipo);
                  setShowCriarPastaDialog(true);
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                Nova Pasta
              </Button>
            </div>
            
            <Button 
              onClick={() => handleUpload(tipo)} 
              className="w-full sm:w-auto flex items-center gap-2"
              disabled={loading || uploading}
            >
              <FileUp size={16} />
              Upload
            </Button>
          </div>
        </div>

        {/* Lista de pastas (se estiver na raiz) */}
        {!pastaSelecionada && pastas.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Pastas disponíveis:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pastas.map((pasta) => (
                <Card 
                  key={pasta.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleSelecionarPasta(pasta)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FolderOpen size={20} className="text-blue-500" />
                        <div>
                          <h5 className="font-medium text-sm">{pasta.nome}</h5>
                          <p className="text-xs text-gray-500">
                            {pasta.projeto_count} projeto{pasta.projeto_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDialogRenomearPasta(pasta);
                          }}
                          className="p-1 h-8 w-8"
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExcluirPasta(pasta);
                          }}
                          className="p-1 h-8 w-8 text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
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
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShare(projeto.url, projeto.nome)}
                      disabled={loading}
                      title="Compartilhar arquivo"
                      className="p-2"
                    >
                      <Share size={16} />
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
                Enviado em: {new Date(projeto.data_upload).toLocaleDateString()}
              </CardContent>
            </Card>
          ))}
          {projetos.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              {pastaSelecionada 
                ? `Nenhum projeto encontrado na pasta "${pastaSelecionada.nome}"`
                : `Nenhum projeto ${tipo} encontrado`
              }
            </div>
          )}
        </div>
      </div>
    );
  };

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

      {/* Diálogo para criar pasta */}
      <Dialog open={showCriarPastaDialog} onOpenChange={setShowCriarPastaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nomePasta" className="text-right">
                Nome da Pasta:
              </Label>
              <Input
                id="nomePasta"
                value={novaPastaNome}
                onChange={(e) => setNovaPastaNome(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCriarPastaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriarPasta}>Criar Pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para renomear pasta */}
      <Dialog open={showRenomearPastaDialog} onOpenChange={setShowRenomearPastaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Pasta</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="renomearPasta" className="text-right">
                Novo Nome:
              </Label>
              <Input
                id="renomearPasta"
                value={novoNomePasta}
                onChange={(e) => setNovoNomePasta(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenomearPastaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRenomearPasta}>Renomear Pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 