import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glog.app',
  appName: 'GLog',
  webDir: 'dist',
  server: {
<<<<<<< HEAD
    androidScheme: 'https'
=======
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
>>>>>>> origin/master
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
<<<<<<< HEAD
    allowMixedContent: true
=======
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
>>>>>>> origin/master
  }
};

export default config;
