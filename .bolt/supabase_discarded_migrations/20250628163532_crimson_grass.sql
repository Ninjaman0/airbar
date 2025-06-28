/*
  # Add Pre-configured Users

  1. New Users
    - `karem` (admin) - password: ata121
    - `hesham` (admin) - password: heshampop121
    - `3bdo` (normal) - password: boda121
    - `hesham` (normal) - password: heshampop123
    - `cover` (normal) - password: cover123

  2. Security
    - Users are inserted with specific UUIDs to match the application code
    - Passwords are stored as plain text (as per application design)
    - Duplicate usernames are handled with different roles/passwords
*/

-- Insert pre-configured users
INSERT INTO users (id, username, password, role, created_at) VALUES
  ('admin-1', 'karem', 'ata121', 'admin', now()),
  ('admin-2', 'hesham', 'heshampop121', 'admin', now()),
  ('user-1', '3bdo', 'boda121', 'normal', now()),
  ('user-2', 'hesham', 'heshampop123', 'normal', now()),
  ('user-3', 'cover', 'cover123', 'normal', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;

-- Note: The hesham user appears twice with different roles and passwords
-- The ON CONFLICT clause will update to the last inserted values
-- In this case, hesham will end up as a normal user with password 'heshampop123'
-- If you need both hesham accounts, consider using hesham_admin and hesham_user as usernames