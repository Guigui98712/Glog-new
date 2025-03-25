import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type OrientationType = 'portrait' | 'landscape';

interface DeviceInfo {
  type: DeviceType;
  orientation: OrientationType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isMacOS: boolean;
  isWindows: boolean;
  isLinux: boolean;
}

/**
 * Hook para detectar informações sobre o dispositivo e orientação da tela
 */
export const useDevice = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    orientation: 'landscape',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    isLandscape: true,
    isTouchDevice: false,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isEdge: false,
    isMacOS: false,
    isWindows: false,
    isLinux: false,
  });

  useEffect(() => {
    // Função para detectar o tipo de dispositivo
    const detectDeviceType = (): DeviceType => {
      const width = window.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    };

    // Função para detectar a orientação da tela
    const detectOrientation = (): OrientationType => {
      return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    };

    // Função para detectar se é um dispositivo de toque
    const detectTouchDevice = (): boolean => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };

    // Função para detectar o sistema operacional
    const detectOS = () => {
      const userAgent = window.navigator.userAgent;
      const platform = window.navigator.platform;
      
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                   (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/.test(userAgent);
      const isMacOS = /Mac/.test(platform) && !isIOS;
      const isWindows = /Win/.test(platform);
      const isLinux = /Linux/.test(platform) && !isAndroid;
      
      return { isIOS, isAndroid, isMacOS, isWindows, isLinux };
    };

    // Função para detectar o navegador
    const detectBrowser = () => {
      const userAgent = window.navigator.userAgent;
      
      const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
      const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
      const isFirefox = /Firefox/.test(userAgent);
      const isEdge = /Edge/.test(userAgent) || /Edg/.test(userAgent);
      
      return { isSafari, isChrome, isFirefox, isEdge };
    };

    // Função para atualizar as informações do dispositivo
    const updateDeviceInfo = () => {
      const type = detectDeviceType();
      const orientation = detectOrientation();
      const isTouchDevice = detectTouchDevice();
      const os = detectOS();
      const browser = detectBrowser();
      
      setDeviceInfo({
        type,
        orientation,
        isMobile: type === 'mobile',
        isTablet: type === 'tablet',
        isDesktop: type === 'desktop',
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
        isTouchDevice,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        ...os,
        ...browser,
      });
    };

    // Atualizar as informações do dispositivo quando o componente for montado
    updateDeviceInfo();

    // Adicionar listener para atualizar as informações quando a janela for redimensionada
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);

    // Remover listeners quando o componente for desmontado
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  return deviceInfo;
};

export default useDevice; 