-- Create custom function to generate 6-digit OTP
CREATE OR REPLACE FUNCTION generate_6_digit_otp()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create trigger to override OTP generation
CREATE OR REPLACE FUNCTION override_otp_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Override the token with 6-digit code
  NEW.token := generate_6_digit_otp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This approach may not work as Supabase handles OTP generation internally
-- The better approach is to handle this in the application layer
