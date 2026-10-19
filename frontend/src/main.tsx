import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, type Module } from "./auth";
import { Layout } from "./components/Layout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import StudentsPage from "./pages/Students";
import StudentProfilePage from "./pages/StudentProfile";
import ProgrammesPage from "./pages/Programmes";
import FinancePage from "./pages/Finance";
import EmployeesPage from "./pages/Employees";
import DepartmentsPage from "./pages/Departments";
import UsersPage from "./pages/Users";
import SettingsPage from "./pages/Settings";
import ImportExportPage from "./pages/ImportExport";
import { Spinner } from "./components/ui";

function RequireModule({ module, children }: { module: Module; children: React.ReactNode }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!can(module)) {
    return (
      <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
        <h2 className="text-base font-semibold text-gray-900">Not permitted</h2>
        <p className="mt-2 text-sm text-gray-500">
          Your role does not have access to this module. Contact an administrator if you think this is wrong.
        </p>
      </div>
    );
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireModule module="dashboard">
            <Layout />
          </RequireModule>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/students" element={<RequireModule module="students"><StudentsPage /></RequireModule>} />
        <Route path="/students/:id" element={<RequireModule module="students"><StudentProfilePage /></RequireModule>} />
        <Route path="/programmes" element={<RequireModule module="programmes"><ProgrammesPage /></RequireModule>} />
        <Route path="/finance" element={<RequireModule module="finance"><FinancePage /></RequireModule>} />
        <Route path="/hr/employees" element={<RequireModule module="hr"><EmployeesPage /></RequireModule>} />
        <Route path="/hr/departments" element={<RequireModule module="hr"><DepartmentsPage /></RequireModule>} />
        <Route path="/users" element={<RequireModule module="users"><UsersPage /></RequireModule>} />
        <Route path="/settings" element={<RequireModule module="settings"><SettingsPage /></RequireModule>} />
        <Route path="/import-export" element={<RequireModule module="import"><ImportExportPage /></RequireModule>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
