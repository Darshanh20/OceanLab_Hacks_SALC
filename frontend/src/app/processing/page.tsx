"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";

export default function ProcessingPage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to login after 3 seconds
    const timer = setTimeout(() => {
      router.push("/login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="processing-page">
      <div className="processing-container">
        <div className="processing-spinner">
          <Loader size={48} />
        </div>
        <h1>Preparing your summary...</h1>
        <p className="processing-subtitle">
          Our AI is processing your content. You'll be redirected to sign in.
        </p>
      </div>
    </div>
  );
}
