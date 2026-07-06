// --- ASHIRWAD OPERATING SYSTEM COMPLETE ENTERPRISE BACKEND REST API ---
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: '*' })); // Restrict in production environments to your target domain
app.use(express.json());

// Initialize Database Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Middleware for JWT Verification and Route Protection
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: "Access denied. Auth validation token missing." });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token validation context mapping." });
        req.user = user;
        next();
    });
};

// 1. AUTHENTICATION ROOT: SYSTEM SECURITY ATTAINMENT NODE
app.post('/api/auth/login', async (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "Pin verification token code parameter mandatory." });
    
    try {
        // Query the default system master mapping block
        const result = await pool.query('SELECT * FROM users WHERE phone = $1', [process.env.INITIAL_ADMIN_PHONE || '9455855203']);
        if (result.rows.length === 0) return res.status(404).json({ error: "User identity block context target missing." });
        
        const user = result.rows[0];
        const validPin = await bcrypt.compare(pin, user.pin_hash);
        if (!validPin) return res.status(401).json({ error: "Invalid cryptographic credentials code configuration." });
        
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '12h' });
        res.json({ token, role: user.role, name: user.name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. DASHBOARD READS Aggregation Query Engine
app.get('/api/dashboard/metrics', authenticateToken, async (req, res) => {
    try {
        const salesRes = await pool.query("SELECT COALESCE(SUM(net_payable),0) as total FROM sales_invoices WHERE created_at::date = CURRENT_DATE");
        const profitRes = await pool.query("SELECT COALESCE(SUM(net_payable * 0.18),0) as total FROM sales_invoices WHERE created_at::date = CURRENT_DATE");
        const stockValRes = await pool.query("SELECT COALESCE(SUM(current_stock * price_purchase),0) as total FROM products");
        const creditRes = await pool.query("SELECT COALESCE(SUM(balance),0) as total FROM customers WHERE balance > 0");
        
        const recentTxRes = await pool.query("SELECT id, created_at as timestamp, bill_type as type, net_payable as net, payment_mode as mode FROM sales_invoices ORDER BY created_at DESC LIMIT 5");
        const lowStockRes = await pool.query("SELECT code, name, current_stock, min_stock FROM products WHERE current_stock <= min_stock LIMIT 5");

        res.json({
            sales: parseFloat(salesRes.rows[0].total),
            profit: parseFloat(profitRes.rows[0].total),
            stock_valuation: parseFloat(stockValRes.rows[0].total),
            outstanding_credit: parseFloat(creditRes.rows[0].total),
            recent_transactions: recentTxRes.rows,
            alerts: lowStockRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. INVENTORY MATRIX: API ENDPOINTS
app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY code ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    const { code, name, brand, category, sub_category, hsn_code, size_specs, warehouse_loc, current_stock, min_stock, max_stock, price_purchase, price_mrp, gst_percentage } = req.body;
    try {
        const query = `INSERT INTO products (code, name, brand, category, sub_category, hsn_code, size_specs, warehouse_loc, current_stock, min_stock, max_stock, price_purchase, price_mrp, gst_percentage) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`;
        const values = [code, name, brand, category, sub_category, hsn_code, size_specs, warehouse_loc, current_stock, min_stock, max_stock, price_purchase, price_mrp, gst_percentage];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:code', authenticateToken, async (req, res) => {
    const { code } = req.params;
    const { name, brand, category, hsn_code, size_specs, warehouse_loc, current_stock, min_stock, price_purchase, price_mrp, gst_percentage } = req.body;
    try {
        const query = `UPDATE products SET name=$1, brand=$2, category=$3, hsn_code=$4, size_specs=$5, warehouse_loc=$6, current_stock=$7, min_stock=$8, price_purchase=$9, price_mrp=$10, gst_percentage=$11, updated_at=CURRENT_TIMESTAMP WHERE code=$12 RETURNING *`;
        const result = await pool.query(query, [name, brand, category, hsn_code, size_specs, warehouse_loc, current_stock, min_stock, price_purchase, price_mrp, gst_percentage, code]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:code', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE code = $1', [req.params.code]);
        res.json({ success: true, message: "Inventory record matrix array row terminated successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. POINT OF SALE (POS) LIVE TRANSACTION INVOICING CORE
app.post('/api/sales/invoice', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { customer_name, customer_phone, customer_gstin, bill_type, items, discount, payment_mode } = req.body;

        // Verify/Create Customer Record entry context loop mapping
        let custRes = await client.query('SELECT id FROM customers WHERE phone = $1', [customer_phone]);
        let customerId;
        if (custRes.rows.length === 0) {
            let insCust = await client.query('INSERT INTO customers (name, phone, gstin) VALUES ($1, $2, $3) RETURNING id', [customer_name, customer_phone, customer_gstin]);
            customerId = insCust.rows[0].id;
        } else {
            customerId = custRes.rows[0].id;
        }

        // Calculation variables initialization
        let subtotal = 0; let totalGst = 0;
        const processedItems = [];

        for (let item of items) {
            const prodRes = await client.query('SELECT * FROM products WHERE code = $1 FOR UPDATE', [item.code]);
            if (prodRes.rows.length === 0) throw new Error(`Product ${item.code} structural trace missing.`);
            
            const prod = prodRes.rows[0];
            if (prod.current_stock < item.quantity) throw new Error(`Stock deficit breakdown exception for item code ${prod.code}`);

            // Deduct inventory stock balance
            await client.query('UPDATE products SET current_stock = current_stock - $1 WHERE code = $2', [item.quantity, item.code]);

            const lineSubtotal = item.quantity * parseFloat(prod.price_mrp);
            const lineGst = lineSubtotal - (lineSubtotal / (1 + (prod.gst_percentage / 100)));
            
            subtotal += lineSubtotal;
            totalGst += lineGst;

            processedItems.push({ code: prod.code, quantity: item.quantity, price: prod.price_mrp, gst: prod.gst_percentage, total: lineSubtotal });
        }

        const netPayable = Math.max(0, subtotal - parseFloat(discount || 0));
        const cgst = totalGst / 2; const sgst = totalGst / 2;
        const invoiceId = `AS-INV-${Date.now().toString().slice(-8)}`;

        // Insert Invoice master Header record node
        await client.query(
            `INSERT INTO sales_invoices (id, customer_id, staff_id, bill_type, subtotal, discount, cgst, sgst, net_payable, payment_mode) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [invoiceId, customerId, req.user.id, bill_type, subtotal, discount, cgst, sgst, netPayable, payment_mode]
        );

        // Insert transactional breakdown child array lines
        for (let pi of processedItems) {
            await client.query(
                `INSERT INTO sales_items (invoice_id, product_code, quantity, unit_price, gst_rate, total_value) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [invoiceId, pi.code, pi.quantity, pi.price, pi.gst, pi.total]
            );
        }

        // Ledger allocation balancing logic mappings
        if (payment_mode === 'Credit Book') {
            await client.query('UPDATE customers SET balance = balance + $1 WHERE id = $2', [netPayable, customerId]);
        } else {
            await client.query('INSERT INTO accounts_ledger (asset_book, entry_type, amount, description) VALUES ($1, $2, $3, $4)', [payment_mode, 'Income', netPayable, `POS Execution Processing Sale ID: ${invoiceId}`]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, invoiceId, net_payable: netPayable });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 5. LEDGER READS
app.get('/api/ledgers/parties', authenticateToken, async (req, res) => {
    try {
        const customers = await pool.query('SELECT name, phone, gstin, \'Customer\' as type, balance FROM customers');
        const suppliers = await pool.query('SELECT name, phone, gstin, \'Supplier\' as type, balance FROM suppliers');
        res.json([...customers.rows, ...suppliers.rows]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// System Initialization deployment check listener mapping
app.listen(PORT, () => console.log(`🚀 Ashirwad Server Platform initialized safely on operational node port: ${PORT}`));
