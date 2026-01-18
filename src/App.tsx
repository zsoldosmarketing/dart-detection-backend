import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { useConfigStore } from './stores/configStore';
import { useNotificationStore } from './stores/notificationStore';
import { PushNotificationModal } from './components/ui/PushNotificationModal';
import { voiceSettingsSync } from './lib/voiceSettingsSync';

import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { TrainingPage } from './pages/TrainingPage';
import { TrainingSessionPage } from './pages/TrainingSessionPage';
import { GamePage } from './pages/GamePage';
import { GamePlayPage } from './pages/GamePlayPage';
import { GameHistoryPage } from './pages/GameHistoryPage';
import { ClubsPage } from './pages/ClubsPage';
import { ClubDetailPage } from './pages/ClubDetailPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { InboxPage } from './pages/InboxPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { DetailedStatisticsPage } from './pages/DetailedStatisticsPage';
import { WalletPage } from './pages/WalletPage';
import { ChallengesPage } from './pages/ChallengesPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { CRMLayout } from './pages/crm/CRMLayout';
import { CRMDashboard } from './pages/crm/CRMDashboard';
import { CRMConfigPage } from './pages/crm/CRMConfigPage';
import { CRMUsersPage } from './pages/crm/CRMUsersPage';
import { CRMPushPage } from './pages/crm/CRMPushPage';
import { CRMAuditPage } from './pages/crm/CRMAuditPage';
import { CRMHealthPage } from './pages/crm/CRMHealthPage';
import { CRMGDPRPage } from './pages/crm/CRMGDPRPage';
import { PVPMatchmakingPage } from './pages/PVPMatchmakingPage';
import { PVPArenaPage } from './pages/PVPArenaPage';
import { ProgramEnrollmentPage } from './pages/ProgramEnrollmentPage';
import { ProgramDetailPage } from './pages/ProgramDetailPage';
import { PartyGamesPage } from './pages/PartyGamesPage';
import { CricketGamePage } from './pages/CricketGamePage';
import { PlayerProfilesPage } from './pages/PlayerProfilesPage';

function App() {
  const { initialize, isLoading: authLoading, user } = useAuthStore();
  const { setTheme, theme } = useThemeStore();
  const { fetchConfig } = useConfigStore();
  const { fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications } = useNotificationStore();

  useEffect(() => {
    initialize();
    fetchConfig();
  }, [initialize, fetchConfig]);

  useEffect(() => {
    setTheme(theme);
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      subscribeToNotifications(user.id);
      voiceSettingsSync.subscribeToChanges();
    } else {
      unsubscribeFromNotifications();
    }

    return () => {
      unsubscribeFromNotifications();
    };
  }, [user, fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-dark-400 mt-4">Betoltes...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <PushNotificationModal />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />

          <Route
            path="training"
            element={
              <ProtectedRoute>
                <TrainingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="training/:sessionId"
            element={
              <ProtectedRoute>
                <TrainingSessionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="game"
            element={
              <ProtectedRoute>
                <GamePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="game/:roomId"
            element={
              <ProtectedRoute>
                <GamePlayPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="game-history"
            element={
              <ProtectedRoute>
                <GameHistoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="clubs"
            element={
              <ProtectedRoute>
                <ClubsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="clubs/:clubId"
            element={
              <ProtectedRoute>
                <ClubDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="tournaments"
            element={
              <ProtectedRoute>
                <TournamentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="tournaments/:tournamentId"
            element={
              <ProtectedRoute>
                <TournamentDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="inbox"
            element={
              <ProtectedRoute>
                <InboxPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="statistics"
            element={
              <ProtectedRoute>
                <StatisticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="match-stats/:matchId"
            element={
              <ProtectedRoute>
                <DetailedStatisticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="stats-old"
            element={
              <ProtectedRoute>
                <StatisticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="wallet"
            element={
              <ProtectedRoute>
                <WalletPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="challenges"
            element={
              <ProtectedRoute>
                <ChallengesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="subscription"
            element={
              <ProtectedRoute>
                <SubscriptionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="pvp"
            element={
              <ProtectedRoute>
                <PVPMatchmakingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="arena"
            element={
              <ProtectedRoute>
                <PVPArenaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="programs"
            element={
              <ProtectedRoute>
                <ProgramEnrollmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="programs/:enrollmentId"
            element={
              <ProtectedRoute>
                <ProgramDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="party-games"
            element={
              <ProtectedRoute>
                <PartyGamesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="party-game/cricket"
            element={
              <ProtectedRoute>
                <CricketGamePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="player-profiles"
            element={
              <ProtectedRoute>
                <PlayerProfilesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="crm"
            element={
              <ProtectedRoute adminOnly>
                <CRMLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CRMDashboard />} />
            <Route path="config" element={<CRMConfigPage />} />
            <Route path="push" element={<CRMPushPage />} />
            <Route path="users" element={<CRMUsersPage />} />
            <Route path="drills" element={<PlaceholderPage title="Gyakorlatok" />} />
            <Route path="programs" element={<PlaceholderPage title="Programok" />} />
            <Route path="clubs" element={<PlaceholderPage title="Klubok" />} />
            <Route path="tournaments" element={<PlaceholderPage title="Tornak" />} />
            <Route path="audit" element={<CRMAuditPage />} />
            <Route path="health" element={<CRMHealthPage />} />
            <Route path="gdpr" element={<CRMGDPRPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold text-dark-900 dark:text-white">{title}</h2>
      <p className="text-dark-500 dark:text-dark-400 mt-2">
        Ez a funkcio hamarosan elerheto lesz.
      </p>
    </div>
  );
}

export default App;
