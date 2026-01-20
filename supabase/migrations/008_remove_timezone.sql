-- Remove timezone columns from companies and places tables

-- Remove timezone from companies table
ALTER TABLE companies 
DROP COLUMN IF EXISTS timezone;

-- Remove timezone from places table  
ALTER TABLE places
DROP COLUMN IF EXISTS timezone;
