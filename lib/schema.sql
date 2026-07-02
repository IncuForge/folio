-- PostgreSQL / Supabase Schema Definition for Folio

-- 1. DROP TABLES IF THEY EXIST (for clean resets, execute with caution)
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS package_items CASCADE;
-- DROP TABLE IF EXISTS packages CASCADE;
-- DROP TABLE IF EXISTS items CASCADE;

-- 2. CREATE TABLE DEFINITIONS

-- Food Library Items
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'Appetizer', 'Main Course', 'Dessert', etc.
    ingredients TEXT,
    style VARCHAR(100), -- 'Buffet', 'Live Counter', etc.
    image TEXT,
    notes TEXT,
    price NUMERIC(10, 2) DEFAULT 0.00,
    is_available BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Food Packages (Preset menu templates)
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) DEFAULT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-Many join table for Packages and Items
CREATE TABLE package_items (
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (package_id, item_id)
);

-- Client Event Bookings / Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50),
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME,
    venue TEXT,
    guest_count INTEGER,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
    additional_charges JSONB DEFAULT '[]'::jsonb, -- Array of {label: string, amount: number}
    
    -- Booking Deposit Payment
    booking_paid BOOLEAN DEFAULT FALSE,
    booking_amount NUMERIC(10, 2) DEFAULT 0.00,
    booking_payment_notes TEXT, -- Comments on payment collection
    
    -- Second Installment Payment
    second_paid BOOLEAN DEFAULT FALSE,
    second_amount NUMERIC(10, 2) DEFAULT 0.00,
    second_payment_notes TEXT, -- Comments on payment collection
    
    -- Final Balance Payment
    final_paid BOOLEAN DEFAULT FALSE,
    final_amount NUMERIC(10, 2) DEFAULT 0.00,
    final_payment_notes TEXT, -- Comments on payment collection
    
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    package_price NUMERIC(10, 2) DEFAULT 0.00,
    event_end_date DATE,
    packages_selected JSONB DEFAULT '[]'::jsonb,
    sessions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Join table linking orders and selected items (with customized details per order)
CREATE TABLE order_items (
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    PRIMARY KEY (order_id, item_id)
);

-- 3. INDEX OPTIMIZATIONS
CREATE INDEX idx_orders_event_date ON orders(event_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_items_is_deleted ON items(is_deleted);
CREATE INDEX idx_packages_is_deleted ON packages(is_deleted);
CREATE INDEX idx_order_items_item_id ON order_items(item_id);
CREATE INDEX idx_orders_package_id ON orders(package_id);
CREATE INDEX idx_package_items_item_id ON package_items(item_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- Row Level Security is enabled on all tables for database security. 
-- The Next.js server routes connect using the service_role key to bypass RLS.
-- This prevents direct unauthorized public REST access to any table.
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. SEED DATA GENERATOR FOR IMMEDIATE DEMONSTRATIONS
-- Inserts starting values into the items list if empty
INSERT INTO items (name, type, ingredients, style, image, notes) VALUES
('Paneer Tikka', 'Appetizer', '100g paneer, 20g capsicum, 20g onion, 15g curd marinade', 'Live Counter', 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500', 'Serve with mint chutney and lemon wedges'),
('Veg Spring Rolls', 'Appetizer', '2 rolls, 30g cabbage, 15g carrot, 10g spring onions', 'Buffet', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500', 'Keep crispy, serve with sweet chili sauce'),
('Hara Bhara Kabab', 'Appetizer', '2 kababs, 50g spinach, 20g green peas, 15g potato', 'Buffet', 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500', 'Serve warm, garnish with cashew on top'),
('Paneer Butter Masala', 'Main Course', '120g paneer, 60g butter tomato gravy, 10g butter', 'Buffet', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500', 'Rich creamy gravy, garnish with coriander'),
('Veg Biryani', 'Main Course', '150g basmati rice, 40g mixed veggies, 20g curd', 'Buffet', 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500', 'Serve with mixed veg raita'),
('Dal Makhani', 'Main Course', '80g black urad dal, 20g kidney beans, 15g butter', 'Buffet', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500', 'Slow-cooked for 12 hours, top with fresh cream'),
('Butter Naan', 'Bread', '80g maida flour, 10g butter, 5g yeast', 'Live Counter', 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500', 'Serve hot straight from the tandoor'),
('Gulab Jamun', 'Dessert', '2 jamuns, 40g khoya, 10g maida, sugar syrup', 'Buffet', 'https://images.unsplash.com/photo-1589135306090-e1779f24c0d7?w=500', 'Serve warm, garnish with pistachio shavings'),
('Mango Kulfi', 'Dessert', '1 kulfi, 80ml reduced milk, 30g mango pulp', 'Buffet', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500', 'Keep deep frozen until serving'),
('Fresh Lime Soda', 'Beverage', '1 lemon, 25ml sugar syrup, 200ml soda water', 'Live Counter', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500', 'Provide options for sweet, salted, or mixed');

-- Seed sample packages
INSERT INTO packages (id, name, description) VALUES
('aa228646-c236-47e2-aa00-8c29b71d6240', 'Royal Veg Buffet Platter', 'Our premium vegetarian set menu featuring appetizers, mains, breads, and desserts.'),
('bb228646-c236-47e2-aa00-8c29b71d6240', 'Sleek Party Pack', 'A lightweight, cost-effective starter combo containing a star appetizer, biryani, and dessert.');

-- Link default items to packages (Assuming generated UUIDs map correctly or using cross-queries)
INSERT INTO package_items (package_id, item_id)
SELECT 'aa228646-c236-47e2-aa00-8c29b71d6240'::uuid, id FROM items WHERE name IN ('Paneer Tikka', 'Veg Spring Rolls', 'Paneer Butter Masala', 'Veg Biryani', 'Dal Makhani', 'Butter Naan', 'Gulab Jamun', 'Fresh Lime Soda');

INSERT INTO package_items (package_id, item_id)
SELECT 'bb228646-c236-47e2-aa00-8c29b71d6240'::uuid, id FROM items WHERE name IN ('Hara Bhara Kabab', 'Veg Biryani', 'Gulab Jamun');

-- 6. SYSTEM USER ACCOUNTS & ROLES (Admin vs Manager)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'manager', -- 'admin', 'manager'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial admin credentials (SHA-256 hashes of original passwords)
INSERT INTO users (email, password, role) 
VALUES 
('admin1@cater.com', '2582463df0f9a16ca9d54ecee7e5f91387fe7bd097cad5f315840b816002f7c7', 'admin'),
('admin2@cater.com', '836a8e5b71b370802955f584071bfde47224c434ba2a921f920895f833b154e3', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 7. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
('pdfBrandName', 'Cater Flow Premium Catering'),
('currencySymbol', '₹'),
('paymentMethods', '["UPI", "Cash", "Card", "Bank Transfer", "Cheque"]')
ON CONFLICT (key) DO NOTHING;
