"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, authAPI } from "@/lib/api";
import { User } from "@/types";

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Load stored auth on mount
    useEffect(() => {
        const storedToken = localStorage.getItem("salc_token");
        const storedUser = localStorage.getItem("salc_user");

        if (storedToken && storedUser) {
            api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
            setToken(storedToken);
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                localStorage.removeItem("salc_user");
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const response = await authAPI.login(email, password);
        const { access_token, user_id, email: userEmail } = response.data;
        const userData: User = { id: user_id, email: userEmail };

        localStorage.setItem("salc_token", access_token);
        localStorage.setItem("salc_user", JSON.stringify(userData));
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        setToken(access_token);
        setUser(userData);
    }, []);

    const register = useCallback(async (email: string, password: string) => {
        const response = await authAPI.register(email, password);
        const { access_token, user_id, email: userEmail } = response.data;
        const userData: User = { id: user_id, email: userEmail };

        localStorage.setItem("salc_token", access_token);
        localStorage.setItem("salc_user", JSON.stringify(userData));
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        setToken(access_token);
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("salc_token");
        localStorage.removeItem("salc_user");
        delete api.defaults.headers.common.Authorization;
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                login,
                register,
                logout,
                isAuthenticated: !!token && !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
