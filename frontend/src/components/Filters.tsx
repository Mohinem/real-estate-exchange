import React from 'react';


export default function Filters({ value, onChange }: { value: any, onChange: (v:any)=>void }) {
function update(partial: any) { onChange({ ...value, ...partial }); }
return (
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
<input placeholder="Location" value={value.location || ''} onChange={e=>update({location:e.target.value})} />
<select value={value.propertyType || ''} onChange={e=>update({propertyType:e.target.value||null})}>
<option value="">Any Type</option>
<option>apartment</option>
<option>house</option>
<option>villa</option>
<option>land</option>
<option>other</option>
</select>
<input type="number" placeholder="Min Price" value={value.minPrice||''} onChange={e=>update({minPrice:e.target.value})} />
<input type="number" placeholder="Max Price" value={value.maxPrice||''} onChange={e=>update({maxPrice:e.target.value})} />
</div>
);
}