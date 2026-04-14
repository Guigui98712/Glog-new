import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AppVersionConfig {
  platform: 'android' | 'ios' | 'web' | 'all';
  latest_version: string;
  min_supported_version: string | null;
  force_update: boolean;
  store_url: string | null;
  title: string | null;
  message: string | null;
  release_notes: string | null;
  is_active: boolean;
}

const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.glog.app';

const normalizarVersao = (versao: string): number[] => {
  const limpa = versao.trim().replace(/^v/i, '');
  return limpa.split('.').map((parte) => {
    const numero = Number((parte.match(/\d+/) || ['0'])[0]);
    return Number.isFinite(numero) ? numero : 0;
  });
};

const compararVersoes = (atual: string, alvo: string): number => {
  const a = normalizarVersao(atual);
  const b = normalizarVersao(alvo);
  const tamanho = Math.max(a.length, b.length);

  for (let i = 0; i < tamanho; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }

  return 0;
};

const AppUpdateChecker = () => {
  const [aberto, setAberto] = useState(false);
  const [obrigatorio, setObrigatorio] = useState(false);
  const [config, setConfig] = useState<AppVersionConfig | null>(null);
  const [urlLoja, setUrlLoja] = useState<string>('');

  const notas = useMemo(() => {
    if (!config?.release_notes) {
      return [] as string[];
    }

    return config.release_notes
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean);
  }, [config]);

  useEffect(() => {
    let desmontado = false;

    const verificarAtualizacao = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        const plataformaAtual = Capacitor.getPlatform() as 'android' | 'ios' | 'web';

        const { App } = await import('@capacitor/app');
        const infoApp = await App.getInfo();
        const versaoAtual = infoApp.version || '0.0.0';

        const client = supabase as any;
        const { data, error } = await client
          .from('app_version_config')
          .select('platform, latest_version, min_supported_version, force_update, store_url, title, message, release_notes, is_active')
          .eq('is_active', true)
          .in('platform', [plataformaAtual, 'all']);

        if (error || !data || data.length === 0) {
          return;
        }

        const lista = data as AppVersionConfig[];
        const configuracao =
          lista.find((item) => item.platform === plataformaAtual) ||
          lista.find((item) => item.platform === 'all') ||
          null;

        if (!configuracao || !configuracao.latest_version) {
          return;
        }

        const existeNovaVersao = compararVersoes(versaoAtual, configuracao.latest_version) < 0;
        const abaixoMinima = Boolean(
          configuracao.min_supported_version &&
            compararVersoes(versaoAtual, configuracao.min_supported_version) < 0
        );

        if (!existeNovaVersao && !abaixoMinima) {
          return;
        }

        if (desmontado) {
          return;
        }

        const lojaPadrao = plataformaAtual === 'android' ? ANDROID_PLAY_STORE_URL : '';
        setUrlLoja(configuracao.store_url || lojaPadrao);
        setConfig(configuracao);
        setObrigatorio(abaixoMinima || configuracao.force_update);
        setAberto(true);
      } catch {
        // Falha silenciosa: nao bloqueia uso do app se nao conseguir checar versao.
      }
    };

    void verificarAtualizacao();

    return () => {
      desmontado = true;
    };
  }, []);

  const abrirLoja = async () => {
    if (!urlLoja) {
      return;
    }

    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: urlLoja });
        return;
      }
    } catch {
      // segue para fallback web
    }

    window.open(urlLoja, '_blank', 'noopener,noreferrer');
  };

  if (!config) {
    return null;
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (!obrigatorio) {
          setAberto(proximo);
        }
      }}
    >
      <AlertDialogContent className="w-[92vw] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title || 'Atualização disponível'}</AlertDialogTitle>
          <AlertDialogDescription>
            {config.message || 'Existe uma nova versão do app com melhorias e correções.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {notas.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/20 p-3 text-sm">
            <p className="mb-2 font-medium">Novidades</p>
            <ul className="list-disc pl-5 space-y-1">
              {notas.map((nota, idx) => (
                <li key={`${idx}-${nota}`}>{nota}</li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          {!obrigatorio && <AlertDialogCancel>Agora não</AlertDialogCancel>}
          <AlertDialogAction onClick={abrirLoja}>Atualizar agora</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AppUpdateChecker;
