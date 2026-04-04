"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            // Check both context auth and localStorage token as fallback
            const tokenFromStorage = typeof window !== "undefined" ? localStorage.getItem("salc_token") : null;
            const isAuth = isAuthenticated || !!tokenFromStorage;

            if (!isAuth) {
                router.push("/login");
            }
        }
    }, [isAuthenticated, loading, router]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner spinner-large" />
                <p>Loading...</p>
            </div>
        );
    }

    // Allow render if either context is authenticated or localStorage has token
    const tokenFromStorage = typeof window !== "undefined" ? localStorage.getItem("salc_token") : null;
    const isAuth = isAuthenticated || !!tokenFromStorage;

    if (!isAuth) {
        return null;
    }

    return (
        <SessionProvider>
            <Sidebar />
            <main className="main-content">{children}</main>
        </SessionProvider>
    );
}
