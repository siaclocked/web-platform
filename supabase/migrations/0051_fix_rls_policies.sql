-- Fix RLS policies for company creation
-- Allow users to create companies when they don't have one yet

-- Drop existing companies policies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Admins can update their company" ON companies;

-- New companies policies
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id = get_user_company_id());

CREATE POLICY "Users can create company if they don't have one"
  ON companies FOR INSERT
  WITH CHECK (
    -- Allow insert if user doesn't have a company yet
    NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  USING (id = get_user_company_id() AND get_user_role() = 'admin');

-- Also fix users table to allow insertion during signup
DROP POLICY IF EXISTS "Users can insert new users" ON users;

CREATE POLICY "Users can insert new users"
  ON users FOR INSERT
  WITH CHECK (
    -- Allow inserting new user during signup
    id = auth.uid()
  );
