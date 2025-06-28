/*
  # Add External Money and Debt Transactions Tables

  1. New Tables
    - `external_money` - Track external money additions to shifts
      - `id` (uuid, primary key)
      - `amount` (decimal)
      - `reason` (text)
      - `shift_id` (uuid, foreign key)
      - `section` (enum: store, supplement)
      - `timestamp` (timestamptz)
      - `created_by` (text)
    
    - `supplement_debt_transactions` - Track debt payments and additions
      - `id` (uuid, primary key)
      - `type` (enum: payment, debt)
      - `amount` (decimal)
      - `note` (text)
      - `timestamp` (timestamptz)
      - `created_by` (text)

  2. Schema Changes
    - Add `external_money` jsonb field to shifts table

  3. Security
    - Enable RLS on new tables
    - Add policies for public access
    - Create indexes for performance
*/

-- External money table
CREATE TABLE IF NOT EXISTS external_money (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(10,2) NOT NULL,
  reason text NOT NULL,
  shift_id uuid NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  timestamp timestamptz DEFAULT now(),
  created_by text NOT NULL
);

-- Supplement debt transactions table
CREATE TABLE IF NOT EXISTS supplement_debt_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('payment', 'debt')),
  amount decimal(10,2) NOT NULL,
  note text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_by text NOT NULL
);

-- Add external_money field to shifts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'external_money'
  ) THEN
    ALTER TABLE shifts ADD COLUMN external_money jsonb DEFAULT '[]';
  END IF;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'external_money_shift_id_fkey'
  ) THEN
    ALTER TABLE external_money ADD CONSTRAINT external_money_shift_id_fkey 
    FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_external_money_shift_id ON external_money(shift_id);
CREATE INDEX IF NOT EXISTS idx_supplement_debt_transactions_type ON supplement_debt_transactions(type);
CREATE INDEX IF NOT EXISTS idx_supplement_debt_transactions_timestamp ON supplement_debt_transactions(timestamp);

-- Enable RLS only if not already enabled
DO $$
BEGIN
  -- Check if RLS is already enabled for external_money
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'external_money' 
    AND n.nspname = 'public' 
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE external_money ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- Check if RLS is already enabled for supplement_debt_transactions
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'supplement_debt_transactions' 
    AND n.nspname = 'public' 
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE supplement_debt_transactions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies only if they don't exist
DO $$
BEGIN
  -- Create policy for external_money if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'external_money' 
    AND policyname = 'Allow all operations on external_money'
  ) THEN
    CREATE POLICY "Allow all operations on external_money"
      ON external_money
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Create policy for supplement_debt_transactions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'supplement_debt_transactions' 
    AND policyname = 'Allow all operations on supplement_debt_transactions'
  ) THEN
    CREATE POLICY "Allow all operations on supplement_debt_transactions"
      ON supplement_debt_transactions
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;