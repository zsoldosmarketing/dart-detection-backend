import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { Header } from './Header';
import { useAuthStore } from '../../stores/authStore';

export function Layout() {
  const { user } = useAuthStore();

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
    </div>
  );
}
