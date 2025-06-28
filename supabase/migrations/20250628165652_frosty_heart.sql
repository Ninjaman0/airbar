/*
  # Insert Pre-configured Users

  1. New Users
    - `karem` (admin)
    - `heshamadmin` (admin) 
    - `3bdo` (normal user)
    - `heshamuser` (normal user)
    - `cover` (normal user)

  2. Security
    - Uses proper UUIDs for user IDs
    - Handles conflicts by updating existing users
*/

-- Insert pre-configured users one by one to avoid duplicate conflicts
INSERT INTO users (id, username, password, role, created_at) 
SELECT gen_random_uuid(), 'karem', 'ata121', 'admin', now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'karem');

INSERT INTO users (id, username, password, role, created_at) 
SELECT gen_random_uuid(), 'heshamadmin', 'heshampop121', 'admin', now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'heshamadmin');

INSERT INTO users (id, username, password, role, created_at) 
SELECT gen_random_uuid(), '3bdo', 'boda121', 'normal', now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = '3bdo');

INSERT INTO users (id, username, password, role, created_at) 
SELECT gen_random_uuid(), 'heshamuser', 'heshampop123', 'normal', now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'heshamuser');

INSERT INTO users (id, username, password, role, created_at) 
SELECT gen_random_uuid(), 'cover', 'cover123', 'normal', now()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'cover');

-- Update existing users if they already exist
UPDATE users SET password = 'ata121', role = 'admin' WHERE username = 'karem';
UPDATE users SET password = 'heshampop121', role = 'admin' WHERE username = 'heshamadmin';
UPDATE users SET password = 'boda121', role = 'normal' WHERE username = '3bdo';
UPDATE users SET password = 'heshampop123', role = 'normal' WHERE username = 'heshamuser';
UPDATE users SET password = 'cover123', role = 'normal' WHERE username = 'cover';