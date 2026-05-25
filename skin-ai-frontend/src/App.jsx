import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import AnalisisBaru from "./pages/AnalisisBaru";
import RekamMedis from "./pages/RekamMedis";

import MainLayout from "./layouts/MainLayout";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import { LoadingScreen, SkeletonCard } from "./components/ui";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const DetailPasien = lazy(() => import("./pages/DetailPasien"));
const Profile = lazy(() => import("./pages/Profile"));
const Result = lazy(() => import("./pages/Result"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const UserHistory = lazy(() => import("./pages/UserHistory"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

function RouteSkeleton() {
  return (
    <div className="page-enter space-y-4">
      <LoadingScreen
        compact
        title="Memuat Halaman"
        subtitle="Menyiapkan tampilan SkinAI..."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

function LazyPage({ children }) {
  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<RouteSkeleton />}>
        {children}
      </Suspense>
    </GlobalErrorBoundary>
  );
}

function ProtectedPage({ children, role }) {
  const { admin } = useAuth();

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  if (role && admin.role !== role) {
    return <Navigate to={admin.role === "user" ? "/user/dashboard" : "/dashboard"} replace />;
  }

  return (
    <GlobalErrorBoundary>
      {children}
    </GlobalErrorBoundary>
  );
}

function ProtectedLayoutPage({ children, role = "admin" }) {
  return (
    <ProtectedPage role={role}>
      <GlobalErrorBoundary>
        <MainLayout>
          {children}
        </MainLayout>
      </GlobalErrorBoundary>
    </ProtectedPage>
  );
}

function ResultRoute() {
  const { admin } = useAuth();

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  const content = (
    <LazyPage>
      <Result />
    </LazyPage>
  );

  if (admin.role === "admin") {
    return <ProtectedLayoutPage>{content}</ProtectedLayoutPage>;
  }

  return <ProtectedPage role="user">{content}</ProtectedPage>;
}

function App() {

  return (
      <BrowserRouter>

        <Routes>

          {/* LOGIN */}
          <Route
            path="/"
            element={<Login />}
          />

          {/* DASHBOARD */}
          <Route
            path="/dashboard"
            element={
              <ProtectedLayoutPage>
                <LazyPage>
                  <Dashboard />
                </LazyPage>
              </ProtectedLayoutPage>
            }
          />

          <Route
            path="/user/dashboard"
            element={
              <ProtectedPage role="user">
                <LazyPage>
                  <UserDashboard />
                </LazyPage>
              </ProtectedPage>
            }
          />

          <Route
            path="/user/history"
            element={
              <ProtectedPage role="user">
                <LazyPage>
                  <UserHistory />
                </LazyPage>
              </ProtectedPage>
            }
          />

          <Route
            path="/user/profile"
            element={
              <ProtectedPage role="user">
                <LazyPage>
                  <UserProfile />
                </LazyPage>
              </ProtectedPage>
            }
          />

          {/* ANALISIS BARU */}
          <Route
            path="/analisis"
            element={
              <ProtectedLayoutPage>
                <AnalisisBaru />
              </ProtectedLayoutPage>
            }
          />

          {/* REKAM MEDIS */}
          <Route
            path="/rekam-medis"
            element={
              <ProtectedLayoutPage>
                <RekamMedis />
              </ProtectedLayoutPage>
            }
          />

          {/* DETAIL PASIEN LAMA */}
          <Route
            path="/pasien/:id"
            element={
              <ProtectedLayoutPage>
                <LazyPage>
                  <DetailPasien />
                </LazyPage>
              </ProtectedLayoutPage>
            }
          />

          {/* DETAIL PASIEN BARU */}
          <Route
            path="/detail/:id"
            element={
              <ProtectedLayoutPage>
                <LazyPage>
                  <DetailPasien />
                </LazyPage>
              </ProtectedLayoutPage>
            }
          />

          {/* PROFILE */}
          <Route
            path="/profile"
            element={
              <ProtectedLayoutPage>
                <LazyPage>
                  <Profile />
                </LazyPage>
              </ProtectedLayoutPage>
            }
          />

          {/* RESULT */}
          <Route
            path="/result/:id"
            element={<ResultRoute />}
          />

        </Routes>

      </BrowserRouter>
  );
}

export default App;


