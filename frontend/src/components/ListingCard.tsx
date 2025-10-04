import { Link } from 'react-router-dom';

export default function ListingCard({ l }: { l: any }) {
  const price = `${l.currency || ''}${Number(l.price).toLocaleString()}`;
  return (
    <div className="group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Placeholder image stripe (your image URLs can go here later) */}
      <div className="h-40 bg-gradient-to-br from-brand-100 to-white" />
      <div className="p-4">
        <h3 className="text-lg font-semibold line-clamp-1">{l.title}</h3>
        <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-2">
          <span>{l.location}</span>
          <span>·</span>
          <span className="capitalize">{l.propertyType}</span>
          <span>·</span>
          <span className="font-medium text-gray-900">{price}</span>
        </div>
        {l.description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">{l.description}</p>
        )}
        <div className="mt-4">
          <Link
            to={`/listing/${l.id}`}
            className="inline-flex px-3 py-2 text-sm rounded-md border hover:bg-gray-50"
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  );
}
