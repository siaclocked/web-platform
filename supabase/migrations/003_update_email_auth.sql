-- Update users table for email authentication
-- Make email required and phone optional

ALTER TABLE users 
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN phone DROP NOT NULL;

-- Add unique constraint on email (if not exists)
ALTER TABLE users 
ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Update any existing users that might have null email
UPDATE users 
SET email = 'unknown-' || id || '@example.com' 
WHERE email IS NULL;
