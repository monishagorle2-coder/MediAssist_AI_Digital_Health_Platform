import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import api from "../services/api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  demoLogin: (role: User["role"]) => void;
  logout: () => void;
  registerPatient: (data: any) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_KEY = "mediassist_demo_user";

const createDemoUser = (role: User["role"]): User => {
  const names: Record<string, string> = {
    PATIENT: "Demo Patient",
    DOCTOR: "Dr. Demo Doctor",
    RECEPTIONIST: "Demo Receptionist",
    PHARMACIST: "Demo Pharmacist",
    ADMIN: "Demo Administrator",
  };

  return {
    id: `demo-${role.toLowerCase()}`,
    name: names[role] || "Demo User",
    email: `${role.toLowerCase()}@mediassist.demo`,
    role,
    createdAt: new Date().toISOString(),
  } as User;
};

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("mediassist_token")
  );

  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    const savedToken = localStorage.getItem("mediassist_token");
    const savedDemoUser = localStorage.getItem(DEMO_USER_KEY);

    // Restore frontend demo login
    if (savedDemoUser) {
      try {
        const demoUser = JSON.parse(savedDemoUser) as User;
        setUser(demoUser);
        setLoading(false);
        return;
      } catch (error) {
        console.error("Invalid demo user data", error);
        localStorage.removeItem(DEMO_USER_KEY);
      }
    }

    // No real token
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Real backend authentication
    try {
      const response = await api.get("/auth/me");
      setUser(response.data.user);
    } catch (error) {
      console.error("Failed to fetch user context", error);
      localStorage.removeItem("mediassist_token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, [token]);

  // Real backend login
  const login = async (
    email: string,
    password: string
  ): Promise<User> => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const {
      token: newToken,
      user: loggedUser,
    } = response.data;

    localStorage.removeItem(DEMO_USER_KEY);

    localStorage.setItem("mediassist_token", newToken);

    setToken(newToken);
    setUser(loggedUser);

    return loggedUser;
  };

  // Temporary frontend-only login for mentor demonstration
  const demoLogin = (role: User["role"]) => {
    const demoUser = createDemoUser(role);

    localStorage.removeItem("mediassist_token");
    localStorage.setItem(
      DEMO_USER_KEY,
      JSON.stringify(demoUser)
    );

    setToken(null);
    setUser(demoUser);
  };

  const registerPatient = async (data: any): Promise<User> => {
    const response = await api.post(
      "/auth/register-patient",
      data
    );

    const {
      token: newToken,
      user: registeredUser,
    } = response.data;

    localStorage.removeItem(DEMO_USER_KEY);

    localStorage.setItem(
      "mediassist_token",
      newToken
    );

    setToken(newToken);
    setUser(registeredUser);

    return registeredUser;
  };

  const logout = () => {
    localStorage.removeItem("mediassist_token");
    localStorage.removeItem(DEMO_USER_KEY);

    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        demoLogin,
        logout,
        registerPatient,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
};