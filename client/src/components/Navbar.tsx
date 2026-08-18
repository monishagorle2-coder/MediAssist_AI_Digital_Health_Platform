import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { 
  Activity, 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Shield, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Pill, 
  FlaskConical, 
  Receipt, 
  FileText, 
  Trash2, 
  CheckCheck,
  Radio
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useRealtimeNotifications();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case "DOCTOR":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "PATIENT":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "RECEPTIONIST":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "PHARMACIST":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "LAB_TECHNICIAN":
        return "bg-teal-500/20 text-teal-400 border-teal-500/30";
      case "ADMIN":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  const getUserDisplayName = () => {
    if (!user) return "";
    if (user.role === "PATIENT" && user.patient) return user.patient.name;
    if (user.role === "DOCTOR" && user.doctor) return user.doctor.name;
    return user.email.split("@")[0].toUpperCase();
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case "APPOINTMENT":
        return <Calendar className="h-4 w-4 text-cyan-400" />;
      case "QUEUE":
      case "CONSULTATION":
        return <Clock className="h-4 w-4 text-purple-400" />;
      case "DIAGNOSIS":
        return <FileText className="h-4 w-4 text-teal-400" />;
      case "PHARMACY":
        return <Pill className="h-4 w-4 text-amber-400" />;
      case "LABORATORY":
        return <FlaskConical className="h-4 w-4 text-emerald-400" />;
      case "BILLING":
        return <Receipt className="h-4 w-4 text-indigo-400" />;
      default:
        return <Bell className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xl tracking-tight text-white">Medi<span className="text-cyan-400">Assist</span></span>
              <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 bg-cyan-950 text-cyan-300 rounded border border-cyan-800/50">Clinical Edition</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">AI-Enhanced Hospital Decision Support</p>
          </div>
        </div>

        {/* Right Nav Options */}
        {user && (
          <div className="flex items-center space-x-4">
            
            {/* Live SSE Stream Indicator */}
            <div 
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
              title={isConnected ? "Connected to MediAssist Real-Time Stream" : "Reconnecting to Live Stream..."}
            >
              <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse text-emerald-400" : "text-amber-400"}`} />
              <span>{isConnected ? "LIVE" : "CONNECTING"}</span>
            </div>

            {/* Role Badge */}
            <div className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center space-x-1.5 ${getRoleBadgeStyle(user.role)}`}>
              <Shield className="h-3.5 w-3.5" />
              <span>{user.role}</span>
            </div>

            {/* Notifications Dropdown Container */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-xl transition-all border ${
                  showNotifications
                    ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700"
                }`}
                title="Hospital Alerts & Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow-md">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-88 sm:w-96 bg-slate-900/98 backdrop-blur-xl border border-slate-750 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs">
                  <div className="p-3.5 bg-slate-850 border-b border-slate-750 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 space-y-1">
                        <Bell className="h-6 w-6 mx-auto opacity-40 mb-2" />
                        <p className="font-semibold text-slate-400">All caught up!</p>
                        <p className="text-[11px]">No active notifications on record.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 transition-all flex items-start gap-3 ${
                            n.read ? "opacity-60 bg-slate-900 hover:bg-slate-850/50" : "bg-slate-850/90 hover:bg-slate-800"
                          }`}
                        >
                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                            {getNotificationIcon(n.type)}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-bold text-xs truncate ${n.read ? "text-slate-300" : "text-white"}`}>
                                {n.title}
                              </span>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                {formatRelativeTime(n.createdAt)}
                              </span>
                            </div>

                            <p className="text-slate-300 text-[11px] leading-relaxed break-words">
                              {n.message}
                            </p>

                            {n.type && (
                              <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider rounded bg-slate-950 text-slate-400 border border-slate-800">
                                {n.type}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col items-center space-y-1 shrink-0">
                            {!n.read && (
                              <button
                                onClick={() => markAsRead(n.id)}
                                className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg transition-all"
                                title="Mark as read"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(n.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                              title="Delete notification"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-xs">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-none">{getUserDisplayName()}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-none">{user.email}</div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all text-xs flex items-center space-x-1"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline font-medium">Exit</span>
            </button>

          </div>
        )}
      </div>
    </header>
  );
};

