import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const requiredBuildEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '')
    const missing = requiredBuildEnv.filter((name) => !env[name])

    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`)
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        'react-router-dom': '/src/routerCompat.jsx',
      },
    },
    optimizeDeps: {
      exclude: ['react-router-dom'],
    },
  }
})
