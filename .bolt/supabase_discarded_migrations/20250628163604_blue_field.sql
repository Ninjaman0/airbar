/*
  # Add Pre-configured Users to Database

  1. New Users
    - Admin users: karem, hesham (admin role)
    - Normal users: 3bdo, hesham (normal role), cover
    
  2. Notes
    - Uses proper UUID generation for id field
    - Handles username conflicts with ON CONFLICT clause
    - The hesham user appears twice with different roles and passwords
    - The ON CONFLICT clause will update to the last inserted values
    - In this case, hesham will end up as a normal user with password 'heshampop123'
    - If you need both hesham accounts, consider using hesham_admin and hesham_user as usernames
*/

-- Insert pre-configured users with proper UUIDs
INSERT INTO users (id, username, password, role, created_at) VALUES
  (gen_random_uuid(), 'karem', 'ata121', 'admin', now()),
  (gen_random_uuid(), 'hesham', 'heshampop121', 'admin', now()),
  (gen_random_uuid(), '3bdo', 'boda121', 'normal', now()),
  (gen_random_uuid(), 'hesham', 'heshampop123', 'normal', now()),
  (gen_random_uuid(), 'cover', 'cover123', 'normal', now())
ON CONFLICT (username) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  created_at = EXCLUDED.created_at;