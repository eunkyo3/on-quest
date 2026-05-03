import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';

export default function App() {
  return (
    <>
      <header className="app-header">
        <h1>🎮 On-Quest</h1>
        <nav>
          <NavLink to="/employee" className={({ isActive }) => (isActive ? 'active' : '')}>
            신입 사원
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            관리자
          </NavLink>
        </nav>
      </header>
      <main className="app-shell">
        <Routes>
          <Route path="/" element={<Navigate to="/employee" replace />} />
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/employee" replace />} />
        </Routes>
      </main>
    </>
  );
}
