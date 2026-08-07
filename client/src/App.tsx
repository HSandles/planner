import { useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import BlocksPage from "./pages/BlocksPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AuthPage from "./pages/AuthPage";
import VerificationBanner from "./components/VerificationBanner";
import styles from "./App.module.css";

function AppShell() {
  const { user, loading, logout } = useAuth();

  const [showVerified, setShowVerified] = useState(() => {
    return (
      new URLSearchParams(window.location.search).get("verified") === "true"
    );
  });

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!user) return <AuthPage />;

  return (
    <div className={styles.app}>
      {/* Success toast when returning from email verification link */}
      {showVerified && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 text-green-800 px-5 py-3 rounded-lg shadow-lg z-50 text-sm flex items-center gap-3">
          <span>✓ Email verified successfully!</span>
          <button
            onClick={() => setShowVerified(false)}
            className="text-green-600 hover:text-green-800"
          >
            ✕
          </button>
        </div>
      )}

      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <h1>Chronicle</h1>
        </div>
        <nav className={styles.nav}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
          >
            <span className={styles.navIcon}>◷</span>
            <span>Planner</span>
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
            }
          >
            <span className={styles.navIcon}>◈</span>
            <span>Insights</span>
          </NavLink>
        </nav>

        <div className={styles.userSection}>
          <p className={styles.userEmail}>{user.email}</p>
          <button className={styles.logoutBtn} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className={styles.mainWrapper}>
        {/* Verification banner shown until user verifies their email */}
        {!user.verified && <VerificationBanner />}

        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<BlocksPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
