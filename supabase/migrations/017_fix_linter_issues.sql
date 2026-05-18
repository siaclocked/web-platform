-- Migration to fix Supabase Database Linter issues
-- Fixes: RLS disabled errors, function search_path warnings, missing RLS policies

-- ============================================
-- ERRORS: Enable RLS on tables missing it
-- ============================================

-- Enable RLS on folders table
ALTER TABLE IF EXISTS public.folders ENABLE ROW LEVEL SECURITY;

-- Enable RLS on document_permissions table
ALTER TABLE IF EXISTS public.document_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for folders table
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'folders') THEN
    -- Managers can view folders in their company
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'folders' AND policyname = 'Managers can view company folders') THEN
      CREATE POLICY "Managers can view company folders" ON public.folders
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.company_id = folders.company_id
            AND u.role = 'manager'
          )
        );
    END IF;

    -- Managers can create folders in their company
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'folders' AND policyname = 'Managers can create company folders') THEN
      CREATE POLICY "Managers can create company folders" ON public.folders
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.company_id = folders.company_id
            AND u.role = 'manager'
          )
        );
    END IF;

    -- Managers can update folders in their company
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'folders' AND policyname = 'Managers can update company folders') THEN
      CREATE POLICY "Managers can update company folders" ON public.folders
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.company_id = folders.company_id
            AND u.role = 'manager'
          )
        );
    END IF;

    -- Managers can delete folders in their company
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'folders' AND policyname = 'Managers can delete company folders') THEN
      CREATE POLICY "Managers can delete company folders" ON public.folders
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.company_id = folders.company_id
            AND u.role = 'manager'
          )
        );
    END IF;

    -- Workers can view folders they have access to
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'folders' AND policyname = 'Workers can view accessible folders') THEN
      CREATE POLICY "Workers can view accessible folders" ON public.folders
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.company_id = folders.company_id
            AND u.role = 'worker'
          )
        );
    END IF;
  END IF;
END;
$$;

-- ============================================
-- RLS Policies for document_permissions table
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_permissions') THEN
    -- Managers can view document permissions for workers in their company
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_permissions' AND policyname = 'Managers can view document permissions') THEN
      CREATE POLICY "Managers can view document permissions" ON public.document_permissions
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM documents d
            JOIN users worker ON worker.id = d.worker_id
            JOIN users manager ON manager.id = auth.uid()
            WHERE d.id = document_permissions.document_id
            AND manager.company_id = worker.company_id
            AND manager.role = 'manager'
          )
        );
    END IF;

    -- Managers can create document permissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_permissions' AND policyname = 'Managers can create document permissions') THEN
      CREATE POLICY "Managers can create document permissions" ON public.document_permissions
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM documents d
            JOIN users worker ON worker.id = d.worker_id
            JOIN users manager ON manager.id = auth.uid()
            WHERE d.id = document_permissions.document_id
            AND manager.company_id = worker.company_id
            AND manager.role = 'manager'
          )
        );
    END IF;

    -- Managers can update document permissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_permissions' AND policyname = 'Managers can update document permissions') THEN
      CREATE POLICY "Managers can update document permissions" ON public.document_permissions
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM documents d
            JOIN users worker ON worker.id = d.worker_id
            JOIN users manager ON manager.id = auth.uid()
            WHERE d.id = document_permissions.document_id
            AND manager.company_id = worker.company_id
            AND manager.role = 'manager'
          )
        );
    END IF;

    -- Managers can delete document permissions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_permissions' AND policyname = 'Managers can delete document permissions') THEN
      CREATE POLICY "Managers can delete document permissions" ON public.document_permissions
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM documents d
            JOIN users worker ON worker.id = d.worker_id
            JOIN users manager ON manager.id = auth.uid()
            WHERE d.id = document_permissions.document_id
            AND manager.company_id = worker.company_id
            AND manager.role = 'manager'
          )
        );
    END IF;

    -- Workers can view document permissions for their own documents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_permissions' AND policyname = 'Workers can view own document permissions') THEN
      CREATE POLICY "Workers can view own document permissions" ON public.document_permissions
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = document_permissions.document_id
            AND d.worker_id = auth.uid()
          )
        );
    END IF;
  END IF;
END;
$$;

-- Note: policies for schedule_history, shift_interests, timesheet_edits removed.
-- shift_interests and timesheet_edits are dropped in migration 018.
-- schedule_history is retained but its schema doesn't have schedule_template_id,
-- so the original policies referenced a column that never existed on this schema lineage.

-- ============================================
-- WARNINGS: Fix function search_path
-- ============================================

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fix get_user_company_id function
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT company_id FROM public.users WHERE id = auth.uid());
END;
$$;

-- Fix get_user_role function (keep VARCHAR return to match original signature)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$;

-- Fix generate_6_digit_otp function
CREATE OR REPLACE FUNCTION public.generate_6_digit_otp()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;

-- Fix override_otp_generation function (check if it exists first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'override_otp_generation') THEN
        EXECUTE '
            CREATE OR REPLACE FUNCTION public.override_otp_generation()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            SECURITY INVOKER
            SET search_path = public
            AS $func$
            BEGIN
                IF NEW.otp IS NULL THEN
                    NEW.otp = public.generate_6_digit_otp();
                END IF;
                RETURN NEW;
            END;
            $func$;
        ';
    END IF;
END;
$$;

-- ============================================
-- WARNINGS: Improve overly permissive RLS policies
-- Note: The signup policies need to allow anonymous inserts,
-- but we can add some basic validation
-- ============================================

-- Drop and recreate company signup policy with basic validation
DROP POLICY IF EXISTS "Allow anonymous company creation during signup" ON public.companies;
CREATE POLICY "Allow anonymous company creation during signup" ON public.companies
  FOR INSERT WITH CHECK (
    -- Allow insert but ensure required fields are present
    name IS NOT NULL AND name != ''
  );

-- Drop and recreate user signup policy with basic validation  
DROP POLICY IF EXISTS "Allow user creation during signup" ON public.users;
CREATE POLICY "Allow user creation during signup" ON public.users
  FOR INSERT WITH CHECK (
    -- Allow insert but ensure required fields are present
    email IS NOT NULL AND email != '' AND
    role IS NOT NULL AND role IN ('manager', 'worker')
  );
