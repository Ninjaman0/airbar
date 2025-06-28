/*
  # Add Pre-configured Users to Database

  1. New Users
    - Admin users: karem, heshamadmin (admin role)
    - Normal users: 3bdo, heshamuser, cover (normal role)
    
  2. Notes
    - Uses proper UUID generation for id field
    - Handles username conflicts with individual INSERT statements
    - Renamed duplicate hesham users to heshamadmin and heshamuser for clarity
    - Each INSERT is protected with WHERE NOT EXISTS to avoid conflicts
*/

-- Insert pre-configured users individually to avoid duplicate conflicts
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