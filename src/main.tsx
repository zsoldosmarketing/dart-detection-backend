import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { onLocaleChange, setLocale, getLocale } from './lib/i18n';
import { voiceCaller } from './lib/voiceCaller';
import { voiceRecognition } from './lib/voiceRecognition';

if (typeof window !== 'undefined') {
  localStorage.setItem('force-hungarian-locale', 'true');
  localStorage.setItem('app-locale', 'hu');
  if (getLocale() !== 'hu') {
    setLocale('hu');
  }
}

onLocaleChange(() => {
  voiceCaller.updateLanguage();
  voiceRecognition.updateLanguage();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FORCE_HUNGARIAN_LOCALE') {
      console.log('[PWA] Magyar nyelv kikényszerítve');
      localStorage.setItem('force-hungarian-locale', 'true');
      localStorage.setItem('app-locale', 'hu');
      if (getLocale() !== 'hu') {
        setLocale('hu');
      }
    }
    if (event.data && event.data.type === 'FORCE_RELOAD') {
      console.log('[PWA] Automatikus újratöltés cache frissítés után');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(
      (registration) => {
        console.log('[PWA] ServiceWorker regisztrálva:', registration.scope);

        registration.update();

        setInterval(() => {
          console.log('[PWA] Cache frissítés ellenőrzése...');
          registration.update();
        }, 30000);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('[PWA] Új verzió telepítése...');
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              console.log('[PWA] Service Worker állapot:', newWorker.state);
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Új verzió telepítve, automatikus újratöltés...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      },
      (err) => {
        console.error('[PWA] ServiceWorker regisztráció sikertelen:', err);
      }
    );

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        console.log('[PWA] Service Worker lecserélve, oldal újratöltése...');
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
