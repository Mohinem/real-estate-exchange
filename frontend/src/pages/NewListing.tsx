import React from "react";
import Layout from "../components/Layout";

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
  const token = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

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

  // generate & clean up previews
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
    setImages(files);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(undefined);

    if (!form.title.trim()) return setErr("Please provide a title.");
    if (!form.location.trim()) return setErr("Please provide a location.");
    if (!form.price || Number(form.price) <= 0) return setErr("Please set a valid price.");

    setSubmitting(true);
    try {
      // NOTE: images are preview-only in this demo. In production upload to S3/Cloudinary first.
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
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      // Optional: you can read the new ID here if backend returns it
      // const data = await res.json();

      // For now, go back to dashboard
      location.href = "/dashboard";
    } catch (e: any) {
      setErr(e.message || "Failed to create listing.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Listing</h1>
        <p className="mt-1 text-sm text-gray-600">
          Add a property to the marketplace. You can edit details later from your dashboard.
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-4xl rounded-2xl border bg-white p-6 shadow-sm"
      >
        {err && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="e.g. 2BHK near Salt Lake"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              rows={5}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="Describe the property, amenities, nearby landmarks, etc."
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Price</label>
            <input
              type="number"
              min={0}
              step="1"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="5500000"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              required
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Currency</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="INR"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value.toUpperCase())}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="Kolkata, WB"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Property Type</label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              value={form.property_type}
              onChange={(e) => update("property_type", e.target.value as FormState["property_type"])}
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
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="e.g. Prefer exchange within city"
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
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              placeholder="email or phone"
              value={form.contact_info}
              onChange={(e) => update("contact_info", e.target.value)}
            />
          </div>

          {/* Images */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Images</label>
            <div className="mt-1 rounded-lg border border-dashed bg-gray-50 p-4">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onPickFiles}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white file:hover:bg-brand-700"
              />
              {previews.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {previews.map((u, i) => (
                    <div key={u} className="relative">
                      <img
                        src={u}
                        className="h-28 w-full rounded-md border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                For demo we only preview images. In production, upload to S3/Cloudinary and save URLs.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <a
            href="/dashboard"
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Layout>
  );
}
