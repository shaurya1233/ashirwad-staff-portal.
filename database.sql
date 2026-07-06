-- --- ASHIRWAD SANITARY & TILES DATABASE SYSTEM STRUCTURE ---
-- Relational Database Engine Target: PostgreSQL (14+)

-- Enable Cryptographic Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if exists for deterministic migrations
DROP TABLE IF EXISTS accounts_ledger CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS sales_items CASCADE;
DROP TABLE IF EXISTS sales_invoices CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS / STAFF AUTHORIZATION TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pin_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Manager', 'Sales Staff')),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. PRODUCTS / INVENTORY MATRIX TABLE
CREATE TABLE products (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('Tiles', 'Sanitaryware', 'Fittings', 'Adhesives')),
    sub_category VARCHAR(100),
    hsn_code VARCHAR(10) NOT NULL,
    size_specs VARCHAR(50),
    warehouse_loc VARCHAR(100),
    current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock INT NOT NULL DEFAULT 10,
    max_stock INT NOT NULL DEFAULT 1000,
    price_purchase NUMERIC(12,2) NOT NULL CHECK (price_purchase >= 0),
    price_mrp NUMERIC(12,2) NOT NULL CHECK (price_mrp >= 0),
    gst_percentage INT NOT NULL CHECK (gst_percentage IN (0, 5, 12, 18, 28)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CUSTOMER LEDGER INDEX
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    gstin VARCHAR(15),
    address TEXT,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- Positive denotes receivable (outstanding credit)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. SUPPLIER VENDOR INDEX
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    gstin VARCHAR(15),
    address TEXT,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- Negative denotes tracking payables
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. SALES INVOICES HEADERS TABLE
CREATE TABLE sales_invoices (
    id VARCHAR(50) PRIMARY KEY, -- Formatted: AS-INV-YYYYMMDD-XXXX
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    staff_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    bill_type VARCHAR(30) NOT NULL CHECK (bill_type IN ('Retail Estimate', 'GST Tax Invoice', 'Wholesale Trade')),
    subtotal NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_payable NUMERIC(12,2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Credit Book')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SALES INVOICE LINE ITEMS RELATION
CREATE TABLE sales_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_code VARCHAR(50) REFERENCES products(code) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL,
    gst_rate INT NOT NULL,
    total_value NUMERIC(12,2) NOT NULL
);

-- 7. PURCHASE INWARD VOUCHERS TABLE
CREATE TABLE purchases (
    id VARCHAR(50) PRIMARY KEY, -- PUR-YYYYMMDD-XXXX
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) NOT NULL, -- Vendor's physical invoice number
    total_cost NUMERIC(12,2) NOT NULL,
    payment_mode VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. PURCHASE LINE ITEMS
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id VARCHAR(50) REFERENCES purchases(id) ON DELETE CASCADE,
    product_code VARCHAR(50) REFERENCES products(code) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    purchase_price NUMERIC(12,2) NOT NULL
);

-- 9. CASH/BANK FINANCIAL ACCOUNTING VOUCHER BOOK
CREATE TABLE accounts_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_book VARCHAR(30) NOT NULL CHECK (asset_book IN ('Cash', 'UPI', 'Bank')),
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('Income', 'Expense', 'Asset Sale', 'Asset Purchase')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --- INDEX OPTIMIZATION SCHEME FOR HIGH ENTERPRISE THROUGHPUT ---
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_invoices_date ON sales_invoices(created_at);
CREATE INDEX idx_sales_items_invoice ON sales_items(invoice_id);
CREATE INDEX idx_accounts_ledger_book ON accounts_ledger(asset_book);

-- Seed Initial Default Dummy Framework to activate first boot lookup pathing safely
INSERT INTO users (id, pin_hash, phone, role, name) VALUES 
('cfb8956e-1d54-46b3-96b6-89689e47f9fa', '$2a$10$Wq0G7D.YwS/B9eNn0XwK6O8K6vI9N0NfepH.K27O7bJ5fG5e1G2hW', '9455855203', 'Admin', 'Arvind Mittal')
ON CONFLICT DO NOTHING;
-- Note: Password pin hash corresponds to decrypted numerical credential '9455855203'
