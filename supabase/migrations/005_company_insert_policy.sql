-- Add policy to allow company creation during signup
-- This allows unauthenticated users to create companies (for signup)

CREATE POLICY "Allow anonymous company creation during signup"
  ON companies FOR INSERT
  WITH CHECK (true);

-- Also add policy for user creation during signup
CREATE POLICY "Allow user creation during signup"
  ON users FOR INSERT
  WITH CHECK (true);
