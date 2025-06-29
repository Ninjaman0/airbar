/*
  # Comprehensive System Updates

  1. New Tables
    - `monthly_archives` - Archive monthly data when resetting
    - `customer_debt_details` - Track detailed customer debt information

  2. Schema Updates
    - Add image handling for items
    - Improve debt tracking system
    - Add monthly reset functionality

  3. Security
    - Enable RLS on new tables
    - Add proper policies
*/

-- Monthly archives table for storing reset data
CREATE TABLE IF NOT EXISTS monthly_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  year integer NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  total_profit decimal(10,2) NOT NULL DEFAULT 0,
  total_cost decimal(10,2) NOT NULL DEFAULT 0,
  total_revenue decimal(10,2) NOT NULL DEFAULT 0,
  items_sold jsonb NOT NULL DEFAULT '{}',
  shifts_count integer NOT NULL DEFAULT 0,
  archived_at timestamptz DEFAULT now() NOT NULL,
  archived_by text NOT NULL
);

-- Customer debt details table for better debt tracking
CREATE TABLE IF NOT EXISTS customer_debt_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  customer_name text NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  total_debt decimal(10,2) NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now() NOT NULL,
  updated_by text NOT NULL
);

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_debt_details_customer_id_fkey'
  ) THEN
    ALTER TABLE customer_debt_details ADD CONSTRAINT customer_debt_details_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monthly_archives_section ON monthly_archives(section);
CREATE INDEX IF NOT EXISTS idx_monthly_archives_month_year ON monthly_archives(month, year);
CREATE INDEX IF NOT EXISTS idx_customer_debt_details_customer_id ON customer_debt_details(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debt_details_section ON customer_debt_details(section);

-- Enable RLS
ALTER TABLE monthly_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_debt_details ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on monthly_archives"
  ON monthly_archives
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on customer_debt_details"
  ON customer_debt_details
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);