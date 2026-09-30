import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import App from './app/App'
import './styles/index.css'

async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return

  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setStyle({ style: Style.Dark })
  } catch {
    // StatusBar is unavailable in some simulators.
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
  } catch {
    // Keyboard plugin is not present on every platform build.
  }

  await CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      void CapApp.exitApp()
    }
  })

  await SplashScreen.hide()
}

void initNativeShell()

// Redirect all relative /api requests to VITE_API_URL if configured.
// For production and native builds, fall back to the hosted backend URL if VITE_API_URL is not set.
const originalFetch = window.fetch;
window.fetch = function (input, init) {
    const envApiUrl = (import.meta.env.VITE_API_URL as string) || '';
    const defaultProdApiUrl =
      import.meta.env.PROD || Capacitor.isNativePlatform()
        ? 'https://visiting-backend.onrender.com'
        : '';
    const baseUrl = envApiUrl || defaultProdApiUrl;

  if (baseUrl) {
    if (typeof input === 'string' && input.startsWith('/api')) {
      return originalFetch(`${baseUrl}${input}`, init);
    }
    if (input instanceof URL && input.pathname.startsWith('/api')) {
      return originalFetch(new URL(`${baseUrl}${input.pathname}${input.search}`), init);
    }
    if (input instanceof Request && new URL(input.url).pathname.startsWith('/api')) {
      const urlObj = new URL(input.url);
      const newUrl = `${baseUrl}${urlObj.pathname}${urlObj.search}`;
      return originalFetch(new Request(newUrl, input), init);
    }
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading app...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
)
