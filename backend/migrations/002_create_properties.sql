-- properties table
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  location TEXT,
  property_type TEXT,
  image_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active'
);