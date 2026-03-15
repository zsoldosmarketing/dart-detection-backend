import { Outlet, useLocation } from 'react-router-dom';
import { Navigation } from './Navigation';
import { Header } from './Header';
import { FloatingAICoach } from '../ai/FloatingAICoach';
import { useAuthStore } from '../../stores/authStore';

function getPageContext(pathname: string): string | undefined {
  if (pathname.startsWith('/game') || pathname.startsWith('/arena') || pathname.startsWith('/pvp')) return 'game';
  if (pathname.startsWith('/training')) return 'training';
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/statistics') || pathname.startsWith('/match-stats')) return 'statistics';
  if (pathname.startsWith('/tournaments')) return 'tournament';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'general';
}

export function Layout() {
  const { user } = useAuthStore();
  const location = useLocation();

  const isAITrainerPage = location.pathname.startsWith('/ai-trainer');
  const pageContext = getPageContext(location.pathname);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-50 to-dark-100 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-50 to-dark-100 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950">
      <Navigation />
      <Header />
      <main className="pt-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8 md:pl-64 transition-all duration-300">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      {!isAITrainerPage && <FloatingAICoach context={pageContext} />}
    </div>
  );
}
