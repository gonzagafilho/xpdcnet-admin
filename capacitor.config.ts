import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.dcinfinity.cliente',
  appName: 'DC NET Cliente',
  webDir: 'public',
  server: {
    url: 'https://xpdcnet.dcinfinity.net.br/cliente',
    cleartext: false,
  },
};

export default config;
