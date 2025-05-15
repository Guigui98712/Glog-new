import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glog.app',
  appName: 'GLog',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    Filesystem: {
      androidPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE'
      ]
    },
    Share: {
      androidPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE'
      ]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Camera: {
      androidPermissions: ['android.permission.CAMERA']
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    inputStyle: 'TEXT',
    backgroundColor: '#FFFFFF',
    allowBackForward: true,
    backButtonBehavior: 'history',
    webViewSettings: {
      textZoom: 100,
      mixedContentMode: 'compatibility',
      allowFileAccess: true,
      allowContentAccess: true,
      usesSpellChecker: true
    }
  },
  copy: {
    include: [
      { source: 'public/dictionaries', target: 'dictionaries' }
    ]
  }
};

export default config;
