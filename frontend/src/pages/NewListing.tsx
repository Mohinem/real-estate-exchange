import React from "react";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

type FormState = {
  title: string;
  description: string;
  price: string;
  currency: string;
  location: string;
  property_type: "apartment" | "house" | "villa" | "land" | "other";
  conditions: string;
  contact_info: string;
};

export default function NewListing() {
  const navigate = useNavigate();

  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
  const isAuthed = !!token;

  const [form, setForm] = React.useState<FormState>({
    title: "",
    description: "",
    price: "",
    currency: "INR",
    location: "",
    property_type: "apartment",
    conditions: "",
    contact_info: "",
  });

  const [images, setImages] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | undefined>();
  const [okMsg, setOkMsg] = React.useState<string | undefined>();

  // previews
  React.useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 12)); // small sanity cap
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(undefined);
    setOkMsg(undefined);

    // Friendly check before hitting the server
    if (!isAuthed) {
      setErr("You must be logged in to create a listing.");
      return;
    }

    if (!form.title.trim()) return setErr("Please provide a title.");
    if (!form.location.trim()) return setErr("Please provide a location.");
    if (!form.price || Number(form.price) <= 0)
      return setErr("Please set a valid price.");

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        price: Number(form.price),
        currency: form.currency || "INR",
        location: form.location.trim(),
        property_type: form.property_type,
        conditions: form.conditions,
        contact_info: form.contact_info,
      };

      const res = await fetch(`${API_URL}/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("You must be logged in to create a listing.");
        }
        throw new Error("Could not create listing. Please try again.");
      }

      setOkMsg("Listing created successfully!");
      // ✅ Client-side navigation (no hard reload → no Vercel 404)
      setTimeout(() => navigate("/dashboard", { replace: true }), 400);
    } catch (e: any) {
      setErr(e?.message || "Could not create listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      {/* Header strip (matches Home.tsx) */}
      <section className="bg-gradient-to-b from-white to-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            Create a new listing
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600 text-base sm:text-lg">
            Add your property to the marketplace. You can edit details later
            from your dashboard.
          </p>
        </div>
      </section>

      {/* Form card */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <form
          onSubmit={onSubmit}
          className="mx-auto w-full max-w-4xl rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
        >
          <div className="px-6 sm:px-8 py-8">
            {/* Friendly auth banner when not logged in */}
            {!isAuthed && (
              <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div>You must be logged in to create a listing.</div>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                >
                  Login
                </button>
              </div>
            )}

            {(err || okMsg) && (
              <div
                className={`mb-6 rounded-lg px-4 py-3 text-sm ${
                  err
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "border border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {err || okMsg}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="e.g., 2BHK near Salt Lake"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="Describe the property, amenities, nearby landmarks, etc."
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Price
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="5500000"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  required
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Currency
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="INR"
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value.toUpperCase())}
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="Kolkata, WB"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  required
                />
              </div>

              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Property Type
                </label>
                <select
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  value={form.property_type}
                  onChange={(e) =>
                    update(
                      "property_type",
                      e.target.value as FormState["property_type"]
                    )
                  }
                >
                  <option value="apartment">apartment</option>
                  <option value="house">house</option>
                  <option value="villa">villa</option>
                  <option value="land">land</option>
                  <option value="other">other</option>
                </select>
              </div>

              {/* Conditions */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Exchange Conditions (optional)
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="e.g., Prefer exchange within city"
                  value={form.conditions}
                  onChange={(e) => update("conditions", e.target.value)}
                />
              </div>

              {/* Contact */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Contact Info (optional)
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  placeholder="email or phone"
                  value={form.contact_info}
                  onChange={(e) => update("contact_info", e.target.value)}
                />
              </div>

              {/* Images */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Images
                </label>
                <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                      Upload up to 12 images. We’ll preview locally (no upload
                      yet).
                    </p>
                    <label className="inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={onPickFiles}
                        className="hidden"
                      />
                      Choose files
                    </label>
                  </div>

                  {previews.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {previews.map((u, i) => (
                        <div key={u} className="relative group">
                          <img
                            src={u}
                            alt={`preview-${i}`}
                            className="h-28 w-full rounded-lg border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setImages((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="absolute right-1 top-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    In production, upload to S3/Cloudinary and store the URLs.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex items-center rounded-lg px-5 py-2 text-sm font-medium text-white transition
                  ${
                    submitting
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }
                `}
              >
                {submitting && (
                  <svg
                    className="mr-2 h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      fill="currentColor"
                    />
                  </svg>
                )}
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </Layout>
  );
}
