import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { useConfigStore } from './stores/configStore';
import { useNotificationStore } from './stores/notificationStore';
import { PushNotificationModal } from './components/ui/PushNotificationModal';
import { voiceSettingsSync } from './lib/voiceSettingsSync';
import { supabase } from './lib/supabase';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const TrainingPage = lazy(() => import('./pages/TrainingPage').then(m => ({ default: m.TrainingPage })));
const TrainingSessionPage = lazy(() => import('./pages/TrainingSessionPage').then(m => ({ default: m.TrainingSessionPage })));
const GamePage = lazy(() => import('./pages/GamePage').then(m => ({ default: m.GamePage })));
const GamePlayPage = lazy(() => import('./pages/GamePlayPage').then(m => ({ default: m.GamePlayPage })));
const GameHistoryPage = lazy(() => import('./pages/GameHistoryPage').then(m => ({ default: m.GameHistoryPage })));
const ClubsPage = lazy(() => import('./pages/ClubsPage').then(m => ({ default: m.ClubsPage })));
const ClubDetailPage = lazy(() => import('./pages/ClubDetailPage').then(m => ({ default: m.ClubDetailPage })));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage').then(m => ({ default: m.TournamentsPage })));
const TournamentDetailPage = lazy(() => import('./pages/TournamentDetailPage').then(m => ({ default: m.TournamentDetailPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const InboxPage = lazy(() => import('./pages/InboxPage').then(m => ({ default: m.InboxPage })));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage').then(m => ({ default: m.StatisticsPage })));
const DetailedStatisticsPage = lazy(() => import('./pages/DetailedStatisticsPage').then(m => ({ default: m.DetailedStatisticsPage })));
const WalletPage = lazy(() => import('./pages/WalletPage').then(m => ({ default: m.WalletPage })));
const ChallengesPage = lazy(() => import('./pages/ChallengesPage').then(m => ({ default: m.ChallengesPage })));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const PVPMatchmakingPage = lazy(() => import('./pages/PVPMatchmakingPage').then(m => ({ default: m.PVPMatchmakingPage })));
const PVPArenaPage = lazy(() => import('./pages/PVPArenaPage').then(m => ({ default: m.PVPArenaPage })));
const ProgramEnrollmentPage = lazy(() => import('./pages/ProgramEnrollmentPage').then(m => ({ default: m.ProgramEnrollmentPage })));
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage').then(m => ({ default: m.ProgramDetailPage })));
const PartyGamesPage = lazy(() => import('./pages/PartyGamesPage').then(m => ({ default: m.PartyGamesPage })));
const CricketGamePage = lazy(() => import('./pages/CricketGamePage').then(m => ({ default: m.CricketGamePage })));
const HalveItGamePage = lazy(() => import('./pages/HalveItGamePage').then(m => ({ default: m.HalveItGamePage })));
const ShanghaiGamePage = lazy(() => import('./pages/ShanghaiGamePage').then(m => ({ default: m.ShanghaiGamePage })));
const KnockoutGamePage = lazy(() => import('./pages/KnockoutGamePage').then(m => ({ default: m.KnockoutGamePage })));
const KillerGamePage = lazy(() => import('./pages/KillerGamePage').then(m => ({ default: m.KillerGamePage })));
const PlayerProfilesPage = lazy(() => import('./pages/PlayerProfilesPage').then(m => ({ default: m.PlayerProfilesPage })));
const AITrainerPage = lazy(() => import('./pages/AITrainerPage').then(m => ({ default: m.AITrainerPage })));

const CRMLayout = lazy(() => import('./pages/crm/CRMLayout').then(m => ({ default: m.CRMLayout })));
const CRMDashboard = lazy(() => import('./pages/crm/CRMDashboard').then(m => ({ default: m.CRMDashboard })));
const CRMConfigPage = lazy(() => import('./pages/crm/CRMConfigPage').then(m => ({ default: m.CRMConfigPage })));
const CRMUsersPage = lazy(() => import('./pages/crm/CRMUsersPage').then(m => ({ default: m.CRMUsersPage })));
const CRMPushPage = lazy(() => import('./pages/crm/CRMPushPage').then(m => ({ default: m.CRMPushPage })));
const CRMAuditPage = lazy(() => import('./pages/crm/CRMAuditPage').then(m => ({ default: m.CRMAuditPage })));
const CRMHealthPage = lazy(() => import('./pages/crm/CRMHealthPage').then(m => ({ default: m.CRMHealthPage })));
const CRMGDPRPage = lazy(() => import('./pages/crm/CRMGDPRPage').then(m => ({ default: m.CRMGDPRPage })));
const CRMAIPage = lazy(() => import('./pages/crm/CRMAIPage').then(m => ({ default: m.CRMAIPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold text-dark-900 dark:text-white">{title}</h2>
      <p className="text-dark-500 dark:text-dark-400 mt-2">
        Ez a funkció hamarosan elérhető lesz.
      </p>
    </div>
  );
}

const PROACTIVE_SESSION_KEY = 'ai_proactive_last_run';

async function triggerProactiveAI() {
  const lastRun = localStorage.getItem(PROACTIVE_SESSION_KEY);
  const now = Date.now();
  if (lastRun && now - parseInt(lastRun) < 12 * 60 * 60 * 1000) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proactive-ai`;
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }).then(() => {
      localStorage.setItem(PROACTIVE_SESSION_KEY, String(now));
    }).catch(() => {});
  } catch {
  }
}

function App() {
  const { initialize, isLoading: authLoading, user } = useAuthStore();
  const { setTheme, theme } = useThemeStore();
  const { fetchConfig } = useConfigStore();
  const { fetchNotifications, subscribeToNotifications, unsubscribeFromNotifications } = useNotificationStore();
  const proactiveTriggeredRef = useRef(false);

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
      if (!proactiveTriggeredRef.current) {
        proactiveTriggeredRef.current = true;
        setTimeout(() => triggerProactiveAI(), 5000);
      }
    } else {
      unsubscribeFromNotifications();
      proactiveTriggeredRef.current = false;
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
          <p className="text-dark-400 mt-4">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <PushNotificationModal />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />

            <Route path="training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
            <Route path="training/:sessionId" element={<ProtectedRoute><TrainingSessionPage /></ProtectedRoute>} />
            <Route path="game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
            <Route path="game/:roomId" element={<ProtectedRoute><GamePlayPage /></ProtectedRoute>} />
            <Route path="game-history" element={<ProtectedRoute><GameHistoryPage /></ProtectedRoute>} />
            <Route path="clubs" element={<ProtectedRoute><ClubsPage /></ProtectedRoute>} />
            <Route path="clubs/:clubId" element={<ProtectedRoute><ClubDetailPage /></ProtectedRoute>} />
            <Route path="tournaments" element={<ProtectedRoute><TournamentsPage /></ProtectedRoute>} />
            <Route path="tournaments/:tournamentId" element={<ProtectedRoute><TournamentDetailPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
            <Route path="statistics" element={<ProtectedRoute><StatisticsPage /></ProtectedRoute>} />
            <Route path="match-stats/:matchId" element={<ProtectedRoute><DetailedStatisticsPage /></ProtectedRoute>} />
            <Route path="stats-old" element={<ProtectedRoute><StatisticsPage /></ProtectedRoute>} />
            <Route path="wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="challenges" element={<ProtectedRoute><ChallengesPage /></ProtectedRoute>} />
            <Route path="subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            <Route path="pvp" element={<ProtectedRoute><PVPMatchmakingPage /></ProtectedRoute>} />
            <Route path="arena" element={<ProtectedRoute><PVPArenaPage /></ProtectedRoute>} />
            <Route path="programs" element={<ProtectedRoute><ProgramEnrollmentPage /></ProtectedRoute>} />
            <Route path="programs/:enrollmentId" element={<ProtectedRoute><ProgramDetailPage /></ProtectedRoute>} />
            <Route path="party-games" element={<ProtectedRoute><PartyGamesPage /></ProtectedRoute>} />
            <Route path="party-game/cricket" element={<ProtectedRoute><CricketGamePage /></ProtectedRoute>} />
            <Route path="party-game/halve-it" element={<ProtectedRoute><HalveItGamePage /></ProtectedRoute>} />
            <Route path="party-game/shanghai" element={<ProtectedRoute><ShanghaiGamePage /></ProtectedRoute>} />
            <Route path="party-game/knockout" element={<ProtectedRoute><KnockoutGamePage /></ProtectedRoute>} />
            <Route path="party-game/killer" element={<ProtectedRoute><KillerGamePage /></ProtectedRoute>} />
            <Route path="player-profiles" element={<ProtectedRoute><PlayerProfilesPage /></ProtectedRoute>} />
            <Route path="ai-trainer" element={<ProtectedRoute><AITrainerPage /></ProtectedRoute>} />

            <Route path="crm" element={<ProtectedRoute adminOnly><CRMLayout /></ProtectedRoute>}>
              <Route index element={<CRMDashboard />} />
              <Route path="config" element={<CRMConfigPage />} />
              <Route path="push" element={<CRMPushPage />} />
              <Route path="users" element={<CRMUsersPage />} />
              <Route path="drills" element={<PlaceholderPage title="Gyakorlatok" />} />
              <Route path="programs" element={<PlaceholderPage title="Programok" />} />
              <Route path="clubs" element={<PlaceholderPage title="Klubok" />} />
              <Route path="tournaments" element={<PlaceholderPage title="Tornák" />} />
              <Route path="audit" element={<CRMAuditPage />} />
              <Route path="health" element={<CRMHealthPage />} />
              <Route path="gdpr" element={<CRMGDPRPage />} />
              <Route path="ai" element={<CRMAIPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
