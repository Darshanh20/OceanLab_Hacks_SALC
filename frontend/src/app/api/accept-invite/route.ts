import { API_URL } from "@/lib/api";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    console.log("[FRONTEND] accept-invite route called with token:", token);

    if (!token) {
        console.error("[FRONTEND] No token provided in query params");
        const errorHtml = `
        <html>
            <head>
                <title>Invitation Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .container { background: white; border-radius: 8px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
                    h1 { color: #ef4444; }
                    p { color: #666; font-size: 16px; line-height: 1.6; }
                    .error { font-size: 50px; color: #ef4444; margin-bottom: 20px; }
                    a { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
                    a:hover { background: #764ba2; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error">✗</div>
                    <h1>Invitation Error</h1>
                    <p>Missing invitation token. This link is invalid.</p>
                    <a href="/organizations">Go to Workspaces</a>
                </div>
            </body>
        </html>
        `;
        return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
    }

    try {
        // Call backend to accept the invite
        console.log("[FRONTEND] Calling backend at:", `${API_URL}/api/organizations/invite/accept?token=${token}`);
        const response = await fetch(`${API_URL}/api/organizations/invite/accept?token=${token}`, {
            method: "GET",
        });

        console.log("[FRONTEND] Backend response status:", response.status);

        if (!response.ok) {
            let error: any = {};
            try {
                error = await response.json();
                console.error("[FRONTEND] Backend error response:", error);
            } catch (e) {
                console.error("[FRONTEND] Could not parse error response as JSON");
            }

            const errorMsg = error.detail || "An error occurred";
            const errorHtml = `
            <html>
                <head>
                    <title>Invitation Error</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                        .container { background: white; border-radius: 8px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
                        h1 { color: #ef4444; margin: 0 0 10px 0; }
                        p { color: #666; font-size: 16px; line-height: 1.6; }
                        .error { font-size: 50px; color: #ef4444; margin-bottom: 20px; }
                        .debug { background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 15px; text-align: left; font-size: 0.85rem; color: #333; }
                        a { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
                        a:hover { background: #764ba2; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="error">✗</div>
                        <h1>Invitation Error</h1>
                        <p>${errorMsg}</p>
                        <div class="debug">Token: ${token}<br/>Status: ${response.status}</div>
                        <a href="/organizations">Go to Workspaces</a>
                    </div>
                </body>
            </html>
            `;
            return new Response(errorHtml, { status: 400, headers: { "Content-Type": "text/html" } });
        }

        const data = await response.json();
        console.log("[FRONTEND] Backend success response:", data);

        const successHtml = `
        <html>
            <head>
                <title>Invitation Accepted!</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .container { background: white; border-radius: 8px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
                    h1 { color: #22c55e; margin: 0 0 10px 0; }
                    p { color: #666; font-size: 16px; line-height: 1.6; }
                    .check { font-size: 60px; color: #22c55e; margin-bottom: 20px; }
                    a { display: inline-block; margin-top: 30px; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
                    a:hover { background: #764ba2; }
                    .redirect-info { font-size: 0.85rem; color: #94a3b8; margin-top: 20px; }
                </style>
                <script>
                    setTimeout(() => {
                        window.location.href = '/organizations';
                    }, 3000);
                </script>
            </head>
            <body>
                <div class="container">
                    <div class="check">✓</div>
                    <h1>Congratulations!</h1>
                    <p>You have successfully accepted the invitation to <strong>${data.org_name}</strong>!</p>
                    <p>You are now a member of the workspace with the role: <strong>${data.role}</strong></p>
                    <p>You can now start collaborating with your team and accessing all workspace features.</p>
                    <a href="/organizations">Go to Workspaces</a>
                    <div class="redirect-info">Redirecting automatically in 3 seconds...</div>
                </div>
            </body>
        </html>
        `;
        return new Response(successHtml, { status: 200, headers: { "Content-Type": "text/html" } });
    } catch (error) {
        console.error("[FRONTEND] Unexpected error:", error);
        const errorHtml = `
        <html>
            <head>
                <title>Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .container { background: white; border-radius: 8px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
                    h1 { color: #ef4444; }
                    p { color: #666; }
                    a { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Error Processing Invitation</h1>
                    <p>An unexpected error occurred. Please try again later.</p>
                    <a href="/organizations">Go to Workspaces</a>
                </div>
            </body>
        </html>
        `;
        return new Response(errorHtml, { status: 500, headers: { "Content-Type": "text/html" } });
    }
}
