/*
  # Add external money and supplement debt transactions

  1. New Tables
    - `external_money`
      - `id` (uuid, primary key)
      - `amount` (decimal)
      - `reason` (text)
      - `shift_id` (uuid, foreign key)
      - `section` (text, check constraint)
      - `timestamp` (timestamptz)
      - `created_by` (text)
    - `supplement_debt_transactions`
      - `id` (uuid, primary key)
      - `type` (text, check constraint for 'payment' or 'debt')
      - `amount` (decimal)
      - `note` (text)
      - `timestamp` (timestamptz)
      - `created_by` (text)

  2. Schema Changes
    - Add `external_money` column to `shifts` table

  3. Security
    - Enable RLS on both new tables
    - Add policies for public access
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

-- Enable RLS
ALTER TABLE external_money ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_debt_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'external_money' 
    AND policyname = 'Allow all operations on external_money'
  ) THEN
    CREATE POLICY "Allow all operations on external_money"
      ON external_money
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'supplement_debt_transactions' 
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