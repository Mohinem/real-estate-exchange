import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../auth/AuthProvider";

type User = {
  id: number;
  email: string;
  display_name: string;
  role: string;
};

type Listing = {
  id: number;
  title: string;
  location: string;
  price: number;
  currency: string;
  propertyType: string;
  is_active?: boolean;
};

export default function Admin() {
  const { user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    console.group("%c[Admin Dashboard Diagnostics]", "color:#0bf;font-weight:bold;");
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      console.log("🔑 Token:", token ? token.slice(0, 30) + "..." : "❌ none");

      if (!token) {
        setError("Missing token. Please log in again.");
        return;
      }

      console.log("📡 Backend:", API_URL);

      const usersUrl = `${API_URL}/admin/users`;
      const listingsUrl = `${API_URL}/admin/listings`;
      console.log("➡️ GET", usersUrl);
      console.log("➡️ GET", listingsUrl);

      const [uRes, lRes] = await Promise.all([
        fetch(usersUrl, {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
          credentials: "include",
        }),
        fetch(listingsUrl, {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
          credentials: "include",
        }),
      ]);

      console.log("🔍 /admin/users:", uRes.status, uRes.statusText);
      console.log("🔍 /admin/listings:", lRes.status, lRes.statusText);

      if (!uRes.ok || !lRes.ok) {
        const uText = await uRes.text().catch(() => "");
        const lText = await lRes.text().catch(() => "");
        console.error("❌ Fetch failed:");
        console.error("   users   ->", uRes.status, uText);
        console.error("   listings->", lRes.status, lText);

        if (uRes.status === 404 || lRes.status === 404) {
          setError("Admin endpoints are not implemented on the backend (/admin/users, /admin/listings).");
        } else if (uRes.status === 403 || lRes.status === 403) {
          setError("Forbidden (403). Your account is not recognized as admin by the backend.");
        } else if (uRes.status === 401 || lRes.status === 401) {
          setError("Unauthorized (401). Token missing/invalid/expired.");
        } else {
          setError("Unable to load admin data.");
        }
        return;
      }

      const [usersData, listingsData] = await Promise.all([
        uRes.json(),
        lRes.json(),
      ]);

      console.log("✅ Users data:", usersData);
      console.log("✅ Listings data:", listingsData);

      setUsers(usersData);
      setListings(listingsData);
    } catch (err: any) {
      console.error("💥 ERROR in loadData():", err?.message || err);
      setError("Unable to load admin data.");
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_URL]);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-gray-600">
              Welcome, {user?.display_name}! Manage users and listings here.
            </p>
          </div>
          <button
            className="px-3 py-1.5 rounded bg-gray-900 text-white text-sm"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loading && <p className="text-gray-500">Loading data…</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Users Table */}
            <section>
              <h2 className="text-xl font-semibold mb-3">Users</h2>
              <div className="overflow-x-auto bg-white rounded-lg shadow p-3">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{u.id}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">{u.display_name}</td>
                        <td className="p-2">{u.role}</td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td className="p-2 text-gray-500" colSpan={4}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Listings Table */}
            <section>
              <h2 className="text-xl font-semibold mb-3">Listings</h2>
              <div className="overflow-x-auto bg-white rounded-lg shadow p-3">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">ID</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Location</th>
                      <th className="p-2">Price</th>
                      <th className="p-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{l.id}</td>
                        <td className="p-2">{l.title}</td>
                        <td className="p-2">{l.location}</td>
                        <td className="p-2">
                          {l.price} {l.currency}
                        </td>
                        <td className="p-2">{l.propertyType}</td>
                      </tr>
                    ))}
                    {!listings.length && (
                      <tr>
                        <td className="p-2 text-gray-500" colSpan={5}>
                          No listings found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
