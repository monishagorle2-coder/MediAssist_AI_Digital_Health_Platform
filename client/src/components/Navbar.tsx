import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Activity, Bell, LogOut, User as UserIcon, Shield, CheckCircle2 } from "lucide-react";
import api from "../services/api";
import type { NotificationItem } from "../types";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get("/hospital/notifications");
      setNotifications(response.data);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/hospital/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
            
            {/* Role Badge */}
            <div className={`px-3 py-1 text-xs font-semibold rounded-full border flex items-center space-x-1.5 ${getRoleBadgeStyle(user.role)}`}>
              <Shield className="h-3.5 w-3.5" />
              <span>{user.role}</span>
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Notifications</span>
                    <span className="text-xs text-cyan-400">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`p-3 text-xs ${n.read ? "opacity-60 bg-slate-900" : "bg-slate-850"}`}>
                          <div className="flex items-start justify-between font-semibold text-slate-200">
                            <span>{n.title}</span>
                            {!n.read && (
                              <button onClick={() => markAsRead(n.id)} className="text-cyan-400 hover:text-cyan-300 text-[10px]">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-slate-400 mt-1 text-[11px] leading-tight">{n.message}</p>
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
