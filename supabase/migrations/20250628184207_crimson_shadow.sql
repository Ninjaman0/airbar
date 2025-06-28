/*
  # Insert pre-configured users

  1. New Users
    - `karem` (admin)
    - `heshamadmin` (admin) - renamed to avoid conflict
    - `3bdo` (normal)
    - `heshamuser` (normal) - renamed to avoid conflict  
    - `cover` (normal)

  2. Security
    - Uses proper UUIDs for user IDs
    - Handles conflicts by updating existing users
    - Ensures no duplicate usernames in single command
*/

-- Insert admin users
INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), 'karem', 'ata121', 'admin', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;

INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), 'heshamadmin', 'heshampop121', 'admin', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;

-- Insert normal users
INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), '3bdo', 'boda121', 'normal', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;

INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), 'heshamuser', 'heshampop123', 'normal', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;

INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), 'cover', 'cover123', 'normal', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;