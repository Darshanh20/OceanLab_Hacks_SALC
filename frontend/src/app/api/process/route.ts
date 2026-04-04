import { NextRequest, NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/api";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const token = request.cookies.get("salc_token")?.value;

        // Forward to Python backend
        const headers: Record<string, string> = {};
        
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${BACKEND_API_URL}/api/process/link`, {
            method: "POST",
            headers,
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Backend error" }));
            return NextResponse.json(
                errorData,
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error("API route error:", error);
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
