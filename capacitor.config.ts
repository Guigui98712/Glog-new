import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glog.app',
  appName: 'G Log',
  webDir: 'dist',
  bundledWebRuntime: true,
  server: {
    androidScheme: 'https',
    cleartext: true,
    errorPath: null,
    hostname: 'app'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreKeyPassword: undefined,
    },
    // Configurações específicas para Android
    overrideUserAgent: 'G Log Android App',
    backgroundColor: '#1E3A8A',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // Habilitar para depuração
    hideLogs: false, // Mostrar logs para depuração
    minSdkVersion: 22, // Android 5.1
    targetSdkVersion: 33, // Android 13
    useLegacyBridge: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1E3A8A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    // Desabilitar temporariamente
    // AppUpdate: {
    //   playStoreUrl: 'https://play.google.com/store/apps/details?id=com.glog.app',
    //   autoUpdateEnabled: true
    // },
    // LiveUpdates: {
    //   appId: 'com.glog.app',
    //   channel: 'production',
    //   autoUpdateMethod: 'background',
    //   maxVersions: 2
    // },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    },
    CapacitorHttp: {
      enabled: true
    },
    CapacitorCookies: {
      enabled: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1E3A8A',
      overlaysWebView: false,
      animated: true
    }
  }
};

export default config;
