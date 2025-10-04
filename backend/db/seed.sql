insert into app_public.users(email, password_hash, display_name, is_verified)
values
('demo@user.com', app_private.hash_password('demo1234'), 'Demo User', true)
on conflict do nothing;


insert into app_public.listings(owner_id, title, description, price, location, property_type, conditions, contact_info)
select id, '2BHK in Kolkata', 'Near Salt Lake', 5500000, 'Kolkata, WB', 'apartment', 'Prefer exchange within city', 'demo@user.com'
from app_public.users where email='demo@user.com'
on conflict do nothing;