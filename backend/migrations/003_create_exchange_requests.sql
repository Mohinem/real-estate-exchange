-- exchange_requests table
CREATE TABLE exchange_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER REFERENCES users(id),
  to_user_id INTEGER REFERENCES users(id),
  property_from_id INTEGER REFERENCES properties(id),
  property_to_id INTEGER REFERENCES properties(id),
  status TEXT DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);