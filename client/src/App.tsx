import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import BlocksPage from "./pages/BlocksPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AuthPage from "./pages/AuthPage";
import styles from "./App.module.css";

function AppShell() {
  const { user, loading, logout } = useAuth();

  // Show nothing while we check for an existing session
  if (loading) return <div className={styles.loading}>Loading…</div>;

  // If not logged in, show the auth page
  if (!user) return <AuthPage />;

  return (
    <div className={styles.app}>
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

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<BlocksPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
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
