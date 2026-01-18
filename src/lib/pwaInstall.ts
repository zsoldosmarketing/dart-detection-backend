import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone ||
                         document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);

      const lastPromptDate = localStorage.getItem('pwa-install-prompt-date');
      const today = new Date().toDateString();

      if (!isStandalone && (!lastPromptDate || lastPromptDate !== today)) {
        const visitCount = parseInt(localStorage.getItem('pwa-visit-count') || '0') + 1;
        localStorage.setItem('pwa-visit-count', visitCount.toString());

        if (visitCount >= 3) {
          setTimeout(() => {
            setShowPrompt(true);
          }, 5000);
        }
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt = null;
      localStorage.removeItem('pwa-visit-count');
      localStorage.removeItem('pwa-install-prompt-date');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstallable(false);
        deferredPrompt = null;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Install error:', error);
      return false;
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-date', new Date().toDateString());
  };

  return {
    isInstallable,
    isInstalled,
    install,
    showPrompt,
    dismissPrompt,
  };
}
