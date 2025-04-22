import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.glog.app',
  appName: 'GLog',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
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
    Camera: {
      androidPermissions: ['android.permission.CAMERA']
    }
  }
};

export default config;
