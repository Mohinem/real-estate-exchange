import { Link } from 'react-router-dom';

type Props = {
  l: any;
  bare?: boolean;          // content-only (no chrome)
  className?: string;      // extra classes to override defaults
};

export default function ListingCard({ l, bare = false, className = '' }: Props) {
  const price = `${l.currency ?? ''}${Number(l.price).toLocaleString()}`;

  // works with either snake_case (DB) or camelCase (API mapped) shapes
  const reserved = !!(l.reserved_exchange_id ?? l.reservedExchangeId);
  const swapped  = (l.is_active === false) || !!(l.exchanged_at ?? l.exchangedAt);
  const status: 'available'|'reserved'|'swapped' = swapped ? 'swapped' : (reserved ? 'reserved' : 'available');

  const StatusPill = () => (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === 'available' ? "bg-green-50 text-green-700 border border-green-200" :
        status === 'reserved'  ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                 "bg-gray-100 text-gray-700 border border-gray-200"
      ].join(" ")}
      title={status === 'reserved' ? "Accepted elsewhere; pending completion" : status === 'swapped' ? "Exchange completed" : "Available"}
    >
      {status === 'available' ? 'Available' : status === 'reserved' ? 'Reserved' : 'Swapped'}
    </span>
  );

  const Inner = () => (
    <>
      {/* image/banner */}
      <div className="h-40 w-full bg-gradient-to-br from-brand-100 to-white" />
      {/* body */}
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold line-clamp-1">{l.title}</h3>
          <StatusPill />
        </div>
        <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-2">
          <span>{l.location}</span><span>·</span>
          <span className="capitalize">{l.property_type ?? l.propertyType}</span><span>·</span>
          <span className="font-medium text-gray-900">{price}</span>
        </div>
        {l.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{l.description}</p>}
        <div className="flex-1" />
        <div className="pt-4">
          <Link
            to={`/listing/${l.id}`}
            className="inline-flex px-3 py-2 text-sm rounded-md border hover:bg-gray-50 transition"
          >
            View details
          </Link>
        </div>
      </div>
    </>
  );

  if (bare) return <div className={`flex h-full flex-col overflow-hidden ${className}`}><Inner /></div>;

  return (
    <article
      className={`group flex h-[320px] flex-col overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      <Inner />
    </article>
  );
}
