import React, { useRef } from 'react';


export default function ImageUpload({ onUrls }: { onUrls: (urls: string[]) => void }) {
const ref = useRef<HTMLInputElement>(null);
const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
const files = Array.from(e.target.files || []);
// NOTE: in production use a real storage (S3/Cloudinary). Here we just create object URLs (runtime-only)
const urls = files.map(f => URL.createObjectURL(f));
onUrls(urls);
};
return (
<div>
<input type="file" multiple accept="image/*" ref={ref} onChange={handle} />
</div>
);
}