/*
  # Insert Pre-configured Users

  1. New Users
    - `karem` (admin) - password: ata121
    - `heshamadmin` (admin) - password: heshampop121
    - `3bdo` (normal) - password: boda121
    - `heshamuser` (normal) - password: heshampop123
    - `cover` (normal) - password: cover123

  2. Security
    - All users created with proper UUID primary keys
    - Passwords stored as provided (application handles authentication)
    - Conflict handling for existing usernames
*/

-- Insert pre-configured users with unique usernames
INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), 'karem', 'ata121', 'admin', now()),
  (gen_random_uuid(), 'heshamadmin', 'heshampop121', 'admin', now()),
  (gen_random_uuid(), '3bdo', 'boda121', 'normal', now()),
  (gen_random_uuid(), 'heshamuser', 'heshampop123', 'normal', now()),
  (gen_random_uuid(), 'cover', 'cover123', 'normal', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;