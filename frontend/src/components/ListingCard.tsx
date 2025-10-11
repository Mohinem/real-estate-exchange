import { Link } from 'react-router-dom';

type Props = {
  l: any;
  /** render without outer card chrome (useful inside other cards) */
  bare?: boolean;
  /** extra classes on the root */
  className?: string;
};

function formatMoney(n: number, currency?: string) {
  try {
    if (!currency) return Number(n).toLocaleString();
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `${currency ?? ''}${Number(n).toLocaleString()}`;
  }
}

export default function ListingCard({ l, bare = false, className = '' }: Props) {
  // Works with camelCase or snake_case shapes
  const reserved = !!(l.reserved_exchange_id ?? l.reservedExchangeId);
  const swapped = l.is_active === false || !!(l.exchanged_at ?? l.exchangedAt);
  const status: 'available' | 'reserved' | 'swapped' =
    swapped ? 'swapped' : reserved ? 'reserved' : 'available';

  const price = formatMoney(l.price, l.currency);
  const propertyType = l.property_type ?? l.propertyType;
  const imageUrl =
    l.imageUrl ??
    l.image_url ??
    (Array.isArray(l.images) && l.images.length ? l.images[0].url : null);

  const statusStyles =
    status === 'available'
      ? 'bg-green-50 text-green-700 ring-green-200'
      : status === 'reserved'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : 'bg-gray-100 text-gray-700 ring-gray-200';

  // Subtle bezel via ring (not a harsh border) + soft shadow
  const CardChrome = ({ children }: { children: React.ReactNode }) =>
    bare ? (
      <div className={`flex h-full flex-col overflow-hidden ${className}`}>{children}</div>
    ) : (
      <article
        className={[
          'group relative flex h-[360px] flex-col overflow-hidden rounded-2xl',
          'bg-white ring-1 ring-gray-100 shadow-sm',
          'transition-all duration-150 hover:shadow-md hover:ring-gray-200',
          'focus-within:ring-[--color-brand-200] focus-within:shadow-md',
          className,
        ].join(' ')}
      >
        {children}
      </article>
    );

  return (
    <CardChrome>
      {/* Media / banner */}
      <div className="relative h-40 w-full overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={l.title ?? 'Listing image'}
            className={`h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] ${
              swapped ? 'grayscale' : ''
            }`}
            loading="lazy"
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-b from-brand-100 to-white ${
              swapped ? 'grayscale' : ''
            }`}
          />
        )}

        {/* gradient fade for legibility */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />

        {/* Status pill (top-left) */}
        <span
          className={[
            'absolute left-3 top-3 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            'ring-1 shadow-[0_1px_0_rgba(0,0,0,0.03)]',
            statusStyles,
          ].join(' ')}
          title={
            status === 'reserved'
              ? 'Accepted elsewhere; pending completion'
              : status === 'swapped'
              ? 'Exchange completed'
              : 'Available'
          }
        >
          {status === 'available' ? 'Available' : status === 'reserved' ? 'Reserved' : 'Swapped'}
        </span>

        {/* Price (top-right) */}
        <span className="absolute right-3 top-3 rounded-md bg-white/95 px-2 py-0.5 text-sm font-semibold text-[--color-brand-700] shadow-sm ring-1 ring-gray-200">
          {price}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
          <Link
            to={`/listing/${l.id}`}
            className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[--color-brand-400] rounded"
          >
            {l.title}
          </Link>
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-600">
          {l.location && <span>{l.location}</span>}
          {l.location && propertyType && <span>•</span>}
          {propertyType && <span className="capitalize">{propertyType}</span>}
        </div>

        {l.description && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-700">{l.description}</p>
        )}

        <div className="flex-1" />

        <div className="pt-4">
          <Link
            to={`/listing/${l.id}`}
            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-[--color-brand-700] hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-[--color-brand-400] outline-none"
            aria-label={`View details for ${l.title}`}
          >
            View details
          </Link>
        </div>
      </div>

      {/* Subtle overlay when swapped */}
      {swapped && (
        <div className="pointer-events-none absolute inset-0 bg-white/45 backdrop-blur-[1px]" />
      )}
    </CardChrome>
  );
}
