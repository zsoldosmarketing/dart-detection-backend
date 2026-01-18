import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900">
      <Navigation />
      <Header />
      <main className="pt-16 pb-20 md:pb-6 md:pl-64">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
