import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./pages/Login";
import { PatientDashboard } from "./pages/PatientDashboard";
import { DoctorDashboard } from "./pages/DoctorDashboard";
import { ReceptionistDashboard } from "./pages/ReceptionistDashboard";
import { PharmacistDashboard } from "./pages/PharmacistDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("appointments");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        <div className="flex items-center space-x-3">
          <div className="h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading MediAssist Platform...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Set default initial tab based on role if activeTab is not set for that role
  const getDefaultTabForRole = () => {
    switch (user.role) {
      case "PATIENT":
        return ["appointments", "reports", "prescriptions", "ai-assistant"].includes(activeTab) ? activeTab : "appointments";
      case "DOCTOR":
        return ["queue", "ai-decision-support", "prescriptions"].includes(activeTab) ? activeTab : "queue";
      case "RECEPTIONIST":
        return ["schedule", "register", "billing"].includes(activeTab) ? activeTab : "schedule";
      case "PHARMACIST":
        return ["prescriptions", "inventory"].includes(activeTab) ? activeTab : "prescriptions";
      case "ADMIN":
        return ["overview", "users", "audit-logs"].includes(activeTab) ? activeTab : "overview";
      default:
        return "appointments";
    }
  };

  const currentTab = getDefaultTabForRole();

  const renderDashboardByRole = () => {
    switch (user.role) {
      case "PATIENT":
        return <PatientDashboard activeTab={currentTab} />;
      case "DOCTOR":
        return <DoctorDashboard activeTab={currentTab} />;
      case "RECEPTIONIST":
        return <ReceptionistDashboard activeTab={currentTab} />;
      case "PHARMACIST":
        return <PharmacistDashboard activeTab={currentTab} />;
      case "ADMIN":
        return <AdminDashboard activeTab={currentTab} />;
      default:
        return <div>Invalid Role</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={currentTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-slate-900/40 to-slate-950">
          <div className="max-w-7xl mx-auto">
            {renderDashboardByRole()}
          </div>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
