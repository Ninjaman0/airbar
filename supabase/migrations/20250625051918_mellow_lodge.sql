/*
  # Initial Database Schema for AIR BAR System

  1. New Tables
    - `users` - User authentication and roles
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `password` (text)
      - `role` (enum: normal, admin)
      - `created_at` (timestamp)
    
    - `categories` - Item categories for both sections
      - `id` (uuid, primary key)
      - `name` (text)
      - `section` (enum: store, supplement)
      - `created_at` (timestamp)
    
    - `items` - Inventory items
      - `id` (uuid, primary key)
      - `name` (text)
      - `sell_price` (decimal)
      - `cost_price` (decimal)
      - `current_amount` (integer, default 0)
      - `image` (text, optional)
      - `category_id` (uuid, foreign key)
      - `section` (enum: store, supplement)
      - `created_at`, `updated_at` (timestamps)
    
    - `customers` - Customer information
      - `id` (uuid, primary key)
      - `name` (text)
      - `section` (enum: store, supplement)
      - `created_at` (timestamp)
    
    - `shifts` - Sales shift tracking
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `username` (text)
      - `section` (enum: store, supplement)
      - `status` (enum: active, closed)
      - `purchases`, `expenses` (jsonb arrays)
      - `total_amount` (decimal)
      - `start_time`, `end_time` (timestamps)
      - `final_inventory`, `discrepancies` (jsonb)
      - `final_cash` (decimal)
      - `close_reason` (text)
      - `validation_status` (enum: balanced, discrepancy)
    
    - `customer_purchases` - Customer purchase history
      - `id` (uuid, primary key)
      - `customer_id` (uuid, foreign key)
      - `customer_name` (text)
      - `items` (jsonb)
      - `total_amount` (decimal)
      - `section` (enum: store, supplement)
      - `shift_id` (uuid, foreign key)
      - `is_paid` (boolean, default false)
      - `timestamp` (timestamp)
    
    - `expenses` - Shift expenses
      - `id` (uuid, primary key)
      - `amount` (decimal)
      - `reason` (text)
      - `shift_id` (uuid, foreign key)
      - `section` (enum: store, supplement)
      - `timestamp` (timestamp)
      - `created_by` (text)
    
    - `supplies` - Inventory restocking
      - `id` (uuid, primary key)
      - `section` (enum: store, supplement)
      - `items` (jsonb)
      - `total_cost` (decimal)
      - `timestamp` (timestamp)
      - `created_by` (text)
    
    - `admin_logs` - Admin action logging
      - `id` (uuid, primary key)
      - `action_type` (text)
      - `item_or_shift_affected` (text)
      - `change_details` (text)
      - `timestamp` (timestamp)
      - `admin_name` (text)
      - `section` (enum: store, supplement)
    
    - `shift_edits` - Shift modification history
      - `id` (uuid, primary key)
      - `shift_id` (uuid, foreign key)
      - `field` (text)
      - `old_value`, `new_value` (jsonb)
      - `reason` (text)
      - `timestamp` (timestamp)
      - `edited_by` (text)
    
    - `supplement_debt` - Debt tracking for supplements
      - `id` (uuid, primary key)
      - `amount` (decimal)
      - `last_updated` (timestamp)
      - `updated_by` (text)
    
    - `settings` - Application settings
      - `key` (text, primary key)
      - `value` (jsonb)

  2. Security
    - All tables created with proper data types and constraints
    - UUID primary keys for better security and performance
    - Enum constraints for data integrity
    - Default values where appropriate
*/

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('normal', 'admin')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sell_price decimal(10,2) NOT NULL,
  cost_price decimal(10,2) NOT NULL,
  current_amount integer NOT NULL DEFAULT 0,
  image text,
  category_id uuid,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  status text NOT NULL CHECK (status IN ('active', 'closed')),
  purchases jsonb NOT NULL DEFAULT '[]',
  expenses jsonb NOT NULL DEFAULT '[]',
  total_amount decimal(10,2) NOT NULL DEFAULT '0',
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  final_inventory jsonb,
  final_cash decimal(10,2),
  discrepancies jsonb DEFAULT '[]',
  close_reason text,
  validation_status text NOT NULL DEFAULT 'balanced' CHECK (validation_status IN ('balanced', 'discrepancy'))
);

-- Customer purchases table
CREATE TABLE IF NOT EXISTS customer_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  customer_name text NOT NULL,
  items jsonb NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  shift_id uuid,
  is_paid boolean NOT NULL DEFAULT false,
  timestamp timestamptz DEFAULT now() NOT NULL
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(10,2) NOT NULL,
  reason text NOT NULL,
  shift_id uuid NOT NULL,
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_by text NOT NULL
);

-- Supplies table
CREATE TABLE IF NOT EXISTS supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL CHECK (section IN ('store', 'supplement')),
  items jsonb NOT NULL,
  total_cost decimal(10,2) NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  created_by text NOT NULL
);

-- Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  item_or_shift_affected text NOT NULL,
  change_details text NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  admin_name text NOT NULL,
  section text CHECK (section IN ('store', 'supplement'))
);

-- Shift edits table
CREATE TABLE IF NOT EXISTS shift_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  edited_by text NOT NULL
);

-- Supplement debt table
CREATE TABLE IF NOT EXISTS supplement_debt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount decimal(10,2) NOT NULL,
  last_updated timestamptz DEFAULT now() NOT NULL,
  updated_by text NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'items_category_id_fkey'
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_purchases_customer_id_fkey'
  ) THEN
    ALTER TABLE customer_purchases ADD CONSTRAINT customer_purchases_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'customer_purchases_shift_id_fkey'
  ) THEN
    ALTER TABLE customer_purchases ADD CONSTRAINT customer_purchases_shift_id_fkey 
    FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'expenses_shift_id_fkey'
  ) THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_shift_id_fkey 
    FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'shift_edits_shift_id_fkey'
  ) THEN
    ALTER TABLE shift_edits ADD CONSTRAINT shift_edits_shift_id_fkey 
    FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_section ON items(section);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_shifts_section ON shifts(section);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_customer_id ON customer_purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_section ON customer_purchases(section);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_is_paid ON customer_purchases(is_paid);
CREATE INDEX IF NOT EXISTS idx_expenses_shift_id ON expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_edits_shift_id ON shift_edits(shift_id);
