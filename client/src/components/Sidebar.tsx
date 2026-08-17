import React from "react";
import { useAuth } from "../context/AuthContext";
import { 
  Calendar, 
  FileText, 
  Pill, 
  UserPlus, 
  Users, 
  FileSpreadsheet, 
  Bot, 
  Stethoscope, 
  ShieldAlert, 
  CreditCard,
  Building2,
  Activity,
  User
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const renderNavLinks = () => {
    switch (role) {
      case "PATIENT":
        return (
          <>
            <button
              onClick={() => setActiveTab("appointments")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "appointments"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Appointments</span>
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "reports"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Medical Records</span>
            </button>
            <button
              onClick={() => setActiveTab("vitals")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "vitals"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Vitals History</span>
            </button>
            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "prescriptions"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Pill className="h-4 w-4" />
              <span>My Prescriptions</span>
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "profile"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <User className="h-4 w-4" />
              <span>My Medical Profile</span>
            </button>
            <button
              onClick={() => setActiveTab("ai-assistant")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "ai-assistant"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Bot className="h-4 w-4 text-emerald-400" />
              <span>AI Health Assistant</span>
            </button>
          </>
        );

      case "DOCTOR":
        return (
          <>
            <button
              onClick={() => setActiveTab("queue")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "queue"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Stethoscope className="h-4 w-4" />
              <span>Patient Queue</span>
            </button>
            <button
              onClick={() => setActiveTab("ai-decision-support")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "ai-decision-support"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
              <span>AI Decision Support</span>
            </button>
            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "prescriptions"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Pill className="h-4 w-4" />
              <span>Issue Prescriptions</span>
            </button>
          </>
        );

      case "RECEPTIONIST":
        return (
          <>
            <button
              onClick={() => setActiveTab("schedule")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "schedule"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Schedule Calendar</span>
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "register"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Register Patient</span>
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "billing"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Billing Counter</span>
            </button>
          </>
        );

      case "PHARMACIST":
        return (
          <>
            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "prescriptions"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Pill className="h-4 w-4" />
              <span>Fulfill Prescriptions</span>
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "inventory"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Medicine Inventory</span>
            </button>
          </>
        );

      case "ADMIN":
        return (
          <>
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Hospital Overview</span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "users"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>User Management</span>
            </button>
            <button
              onClick={() => setActiveTab("audit-logs")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === "audit-logs"
                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>System Audit Logs</span>
            </button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <aside className="w-64 bg-slate-900/60 backdrop-blur border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        <div className="px-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {role} Navigation
          </span>
        </div>
        <nav className="space-y-1.5">{renderNavLinks()}</nav>
      </div>

      {/* Ethical AI Compliance Footer Card */}
      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold">
          <Activity className="h-4 w-4" />
          <span>Clinical AI Guardrails</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
          AI functions strictly as clinical decision support for physicians. Patient access is restricted to verified diagnosis reports.
        </p>
      </div>
    </aside>
  );
};
