// frontend/src/auth/guards.tsx
import React from "react";
import { useAuth } from "./AuthProvider";

type Role = "app_user" | "app_admin" | "admin";

function isAllowed(role: string | undefined | null, allowed: Role[]) {
  console.groupCollapsed("%c[isAllowed Diagnostic]", "color:#0bf;font-weight:bold;");
  console.log("🎭 role:", role ?? "none");
  console.log("🚦 allowedRoles:", allowed);
  const result = !!role && (allowed as string[]).includes(role);
  console.log("✅ allowed?", result);
  console.groupEnd();
  return result;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading")
    return <div className="p-6 text-gray-500 text-sm">Checking session…</div>;
  if (status === "guest")
    return <div className="p-6">Please log in to continue.</div>;
  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();

  console.groupCollapsed("%c[RequireRole Diagnostic]", "color:#f90;font-weight:bold;");
  console.log("🧩 status:", status);
  console.log("👤 user:", user);
  console.log("🚦 required roles:", roles);
  console.groupEnd();

  // Still fetching user info → block UI flash
  if (status === "loading") {
    return <div className="p-6 text-gray-500 text-sm">Checking permissions…</div>;
  }

  // If the provider hasn't hydrated yet (user=null but still authed), wait once more
  if (status === "authed" && !user) {
    console.warn("⏳ RequireRole → user not yet loaded though authed, waiting...");
    return <div className="p-6 text-gray-500 text-sm">Loading profile…</div>;
  }

  // Fully loaded: user missing OR role not allowed
  if (!user || !isAllowed(user.role, roles)) {
    console.warn("❌ RequireRole → no user or role mismatch", { status, user, roles });
    return (
      <div className="p-6 text-red-600 font-medium">
        403 — Not allowed (no user found or role mismatch).
      </div>
    );
  }

  console.log(`✅ RequireRole → Access granted for ${user.email} (${user.role})`);
  return <>{children}</>;
}
