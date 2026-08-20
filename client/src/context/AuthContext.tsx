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
  logout: () => void;
  registerPatient: (data: any) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    // No real token
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Real backend authentication
    try {
      const response = await api.get("/auth/me");
      setUser(response.data.user ?? response.data);
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

    localStorage.setItem("mediassist_token", newToken);

    setToken(newToken);
    setUser(loggedUser);

    return loggedUser;
  };

  const registerPatient = async (data: any): Promise<User> => {
    await api.post("/auth/register", data);
    return await login(data.email, data.password);
  };

  const logout = () => {
    localStorage.removeItem("mediassist_token");

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