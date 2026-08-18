import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import type { NotificationItem } from "../types";

export interface HospitalEventPayload {
  event: string;
  timestamp: string;
  [key: string]: any;
}

export function useRealtimeNotifications(onHospitalEvent?: (event: HospitalEventPayload) => void) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHospitalEventRef = useRef(onHospitalEvent);

  useEffect(() => {
    onHospitalEventRef.current = onHospitalEvent;
  }, [onHospitalEvent]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/notifications");
      if (res.data && Array.isArray(res.data.notifications)) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount ?? res.data.notifications.filter((n: any) => !n.read).length);
      } else if (Array.isArray(res.data)) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n: any) => !n.read).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [user]);

  const connectSSE = useCallback(() => {
    if (!user) return;

    // Retrieve token from localStorage
    const token = localStorage.getItem("token");
    if (!token) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const streamUrl = `${apiBaseUrl}/notifications/stream?token=${encodeURIComponent(token)}`;

    try {
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("connected", () => {
        setIsConnected(true);
        setError(null);
      });

      eventSource.addEventListener("notification", (e) => {
        try {
          const newNotif: NotificationItem = JSON.parse(e.data);
          setNotifications((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          setUnreadCount((prev) => prev + 1);
        } catch (err) {
          console.error("Failed to parse incoming notification:", err);
        }
      });

      eventSource.addEventListener("hospital_event", (e) => {
        try {
          const hospitalEvent: HospitalEventPayload = JSON.parse(e.data);
          if (onHospitalEventRef.current) {
            onHospitalEventRef.current(hospitalEvent);
          }
        } catch (err) {
          console.error("Failed to parse incoming hospital event:", err);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        // Exponential backoff reconnect
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, 5000);
      };
    } catch (err: any) {
      setError(err.message || "Failed to initialize real-time connection");
      setIsConnected(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      connectSSE();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, fetchNotifications, connectSSE]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target && !target.read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  return {
    notifications,
    unreadCount,
    isConnected,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: fetchNotifications,
  };
}
