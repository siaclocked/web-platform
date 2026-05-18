-- Fix users table RLS policy to allow users to read their own record
-- This fixes the circular dependency in get_user_company_id()

-- Drop all relevant policies first to make this migration idempotent
DROP POLICY IF EXISTS "Users can view users in their company" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view others in same company" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert managers" ON users;
DROP POLICY IF EXISTS "Managers can insert workers" ON users;
DROP POLICY IF EXISTS "Managers can update workers" ON users;

-- Create new policies for users table
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view others in same company"
  ON users FOR SELECT
  USING (
    id != auth.uid()
    AND company_id = (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert managers"
  ON users FOR INSERT
  WITH CHECK (
    get_user_role() = 'admin'
    AND company_id = get_user_company_id()
    AND role = 'manager'
  );

CREATE POLICY "Managers can insert workers"
  ON users FOR INSERT
  WITH CHECK (
    get_user_role() = 'manager'
    AND company_id = get_user_company_id()
    AND role = 'worker'
  );

CREATE POLICY "Managers can update workers"
  ON users FOR UPDATE
  USING (
    get_user_role() = 'manager'
    AND company_id = get_user_company_id()
    AND role = 'worker'
  );
