import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export type CampusUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role?: "student" | "admin" | string;
  className?: string | null;
  department?: string | null;
  year?: string | null;
};

type AuthValue = {
  user: CampusUser | null;
  loading: boolean;
  setUser: (user: CampusUser | null) => void;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    department: string;
    year: string;
    className: string;
  }) => Promise<{ success: boolean; email: string; message: string }>;
  signIn: (params: { email: string; password: string }) => Promise<CampusUser>;
  verifyOtp: (email: string, code: string) => Promise<CampusUser>;
  resendOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (params: { name: string; department: string; year: string; className: string }) => Promise<CampusUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  setUser: () => {},
  signUp: async () => { throw new Error("Unimplemented"); },
  signIn: async () => { throw new Error("Unimplemented"); },
  verifyOtp: async () => { throw new Error("Unimplemented"); },
  resendOtp: async () => { throw new Error("Unimplemented"); },
  forgotPassword: async () => { throw new Error("Unimplemented"); },
  resetPassword: async () => { throw new Error("Unimplemented"); },
  updateProfile: async () => { throw new Error("Unimplemented"); },
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CampusUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setUser(data.user || null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signUp = async (params: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    department: string;
    year: string;
    className: string;
  }) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create account.");
    return data;
  };

  const signIn = async (params: { email: string; password: string }): Promise<CampusUser> => {
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || "Failed to sign in.") as any;
      err.requiresVerification = data.requiresVerification;
      err.email = data.email;
      throw err;
    }
    setUser(data.user);
    queryClient.invalidateQueries();
    return data.user;
  };

  const verifyOtp = async (email: string, code: string): Promise<CampusUser> => {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to verify code.");
    setUser(data.user);
    queryClient.invalidateQueries();
    return data.user;
  };

  const resendOtp = async (email: string) => {
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to resend code.");
    return data;
  };

  const forgotPassword = async (email: string) => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send reset code.");
    return data;
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to reset password.");
    return data;
  };

  const updateProfile = async (params: {
    name: string;
    department: string;
    year: string;
    className: string;
  }) => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update profile.");
    if (data.user) {
      setUser(data.user);
    }
    await queryClient.invalidateQueries();
    return data.user;
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    await queryClient.cancelQueries();
    queryClient.clear();
  };

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      setUser,
      signUp,
      signIn,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      updateProfile,
      signOut,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

