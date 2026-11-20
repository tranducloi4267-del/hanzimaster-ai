import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hanzimaster.ai',
  appName: 'HanziMaster AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f172a'
  },
  plugins: {
    Keyboard: {
      resize: 'body'
    }
  }
};

export default config;
