import React from "react";
import { useAuth } from "./AuthProvider";

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
  roles: Array<"app_user" | "app_admin" | "admin">;
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();

  console.debug("DEBUG GUARD:", { status, user, allowed: roles });

  if (status === "loading")
    return <div className="p-6 text-gray-500 text-sm">Checking permissions…</div>;

  if (!user || !roles.includes(user.role))
    return (
      <div className="p-6 text-red-600 font-medium">
        403 — Not allowed.
      </div>
    );

  return <>{children}</>;
}
