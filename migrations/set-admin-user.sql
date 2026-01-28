-- SQL script to set a user as admin
-- Replace 'mpukkonen@gmail.com' with the actual email of the user you want to make admin

-- Method 1: Update existing user metadata
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"admin": true}'::jsonb
WHERE email = 'mpukkonen@gmail.com';

-- Method 2: If the above doesn't work, try this alternative
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{admin}', 
  'true'::jsonb
)
WHERE email = 'mpukkonen@gmail.com';

-- Verify the update worked
SELECT 
  email, 
  raw_user_meta_data,
  raw_user_meta_data ->> 'admin' as is_admin
FROM auth.users 
WHERE email = 'mpukkonen@gmail.com';
