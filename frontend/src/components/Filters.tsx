import React from 'react';

export default function Filters({ value, onChange }: { value: any, onChange: (v:any)=>void }) {
  function update(partial: any) { onChange({ ...value, ...partial }); }

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <input
        className="w-full rounded-md border px-3 py-2"
        placeholder="Location"
        value={value.location || ''}
        onChange={e=>update({location:e.target.value})}
      />
      <select
        className="w-full rounded-md border px-3 py-2"
        value={value.propertyType || ''}
        onChange={e=>update({propertyType:e.target.value||null})}
      >
        <option value="">Any Type</option>
        <option>apartment</option>
        <option>house</option>
        <option>villa</option>
        <option>land</option>
        <option>other</option>
      </select>
      <input
        className="w-full rounded-md border px-3 py-2"
        type="number" placeholder="Min Price"
        value={value.minPrice||''}
        onChange={e=>update({minPrice:e.target.value})}
      />
      <input
        className="w-full rounded-md border px-3 py-2"
        type="number" placeholder="Max Price"
        value={value.maxPrice||''}
        onChange={e=>update({maxPrice:e.target.value})}
      />
    </div>
  );
}
