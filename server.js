const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const dbPath = process.env.VERCEL ? path.join('/tmp', 'database.sqlite') : path.join(__dirname, 'database.sqlite');

let db;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

async function ensureDatabase() {
  if (!db) {
    await initDatabase();
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.use(async (req, res, next) => {
  try {
    await ensureDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

function fetchAll(sql, params = []) {
  const results = db.exec(sql, params);
  if (!results.length) return [];

  const columns = results[0].columns;
  return results[0].values.map(row => {
    return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
  });
}

function fetchOne(sql, params = []) {
  const rows = fetchAll(sql, params);
  return rows[0] || null;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function initDatabase() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
  db = new SQL.Database(fileBuffer || undefined);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      items TEXT,
      total REAL,
      status TEXT,
      payment_status TEXT DEFAULT 'Unpaid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.run('ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT "Unpaid"');
  } catch (error) {
    // Ignore if the column already exists.
  }

  const productCount = Number(fetchOne('SELECT COUNT(*) AS count FROM products')?.count || 0);
  if (productCount === 0) {
    const seed = [
      ['earbuds', 'Premium Wireless Earbuds', 'Audio', 'Rich sound, deep bass, and all-day comfort for busy lifestyles.', 89, 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80'],
      ['watch', 'Smart Fitness Watch', 'Wearables', 'Track workouts, heart rate, and notifications in one sleek device.', 129, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'],
      ['lamp', 'LED Desk Lamp', 'Home', 'Modern lighting with adjustable brightness for productivity and comfort.', 54, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
      ['backpack', 'Urban Travel Backpack', 'Accessories', 'Water-resistant storage with laptop sleeve and ergonomic straps.', 72, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80'],
      ['speaker', 'Portable Bluetooth Speaker', 'Audio', 'Punchy sound and durable design for songs at home or outdoors.', 64, 'https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=900&q=80'],
      ['coffee', 'Premium Coffee Kit', 'Lifestyle', 'Everything needed for a café-style brew at home or the office.', 48, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80']
    ];

    seed.forEach(([id, name, category, description, price, imageUrl]) => {
      db.run(
        'INSERT INTO products (id, name, category, description, price, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, category, description, price, imageUrl]
      );
    });
  }

  persistDatabase();
  console.log('Connected to SQLite database.');
}

function persistDatabase() {
  if (!db) return;
  const binary = db.export();
  fs.writeFileSync(dbPath, Buffer.from(binary));
}

function sendEmail(to, subject, text) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email skipped: SMTP not configured');
    return Promise.resolve();
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject,
    text
  });
}

function sendWhatsApp(message) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('WhatsApp skipped: Twilio not configured');
    return Promise.resolve();
  }

  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
    to: `whatsapp:${process.env.ADMIN_PHONE || '+15551234567'}`,
    body: message
  });
}

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'));
});

app.get('/api/products', (req, res) => {
  try {
    const rows = fetchAll('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    const phoneFilter = normalizePhone(req.query.phone || '');

    const sql = phoneFilter
      ? 'SELECT * FROM orders WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "(", ""), ")", ""), "+", "") = ? ORDER BY created_at DESC'
      : 'SELECT * FROM orders ORDER BY created_at DESC';

    const params = phoneFilter ? [phoneFilter] : [];
    const rows = fetchAll(sql, params);

    res.json(rows.map(order => ({ ...order, items: JSON.parse(order.items || '[]') })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', (req, res) => {
  const { id, name, category, description, price, image_url } = req.body;

  if (!id || !name || !category || !description || !price) {
    res.status(400).json({ error: 'Missing required product fields.' });
    return;
  }

  try {
    db.run('INSERT INTO products (id, name, category, description, price, image_url) VALUES (?, ?, ?, ?, ?, ?)', [id, name, category, description, Number(price), image_url || '']);
    persistDatabase();

    res.json({ success: true, product: { id, name, category, description, price: Number(price), image_url: image_url || '' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;

  try {
    db.run('DELETE FROM products WHERE id = ?', [id]);
    persistDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { customer, address, notes, items } = req.body;

  if (!customer || !address || !items || !items.length) {
    res.status(400).json({ error: 'Missing checkout details.' });
    return;
  }

  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const orderId = `ORD-${Date.now()}`;
  const order = {
    id: orderId,
    customer_name: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    address,
    notes: notes || '',
    items: JSON.stringify(items),
    total,
    status: 'New',
    payment_status: 'Unpaid'
  };

  try {
    db.run(
      'INSERT INTO orders (id, customer_name, phone, email, address, notes, items, total, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [order.id, order.customer_name, order.phone, order.email, order.address, order.notes, order.items, order.total, order.status, order.payment_status]
    );
    persistDatabase();

    const emailText = `New order received:\nOrder ID: ${order.id}\nCustomer: ${customer.fullName}\nPhone: ${customer.phone}\nEmail: ${customer.email}\nAddress: ${address}\nTotal: $${total.toFixed(2)}\nItems: ${items.map(item => `${item.name} x ${item.qty}`).join(', ')}`;

    try {
      await sendEmail(process.env.ADMIN_EMAIL || 'admin@myshop.com', `New order: ${order.id}`, emailText);
      await sendWhatsApp(`New order: ${order.id} | Customer: ${customer.fullName} | Total: $${total.toFixed(2)}`);
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }

    if (stripe) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(total * 100),
          currency: 'usd',
          metadata: { orderId: order.id }
        });

        res.json({
          success: true,
          orderId,
          paymentIntent: paymentIntent.client_secret,
          message: 'Order created successfully. Payment is ready.'
        });
        return;
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
      }
    }

    res.json({ success: true, orderId, message: 'Order created successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    res.status(400).json({ error: 'Status is required.' });
    return;
  }

  try {
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    persistDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/:id/payment-status', (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (!paymentStatus) {
    res.status(400).json({ error: 'Payment status is required.' });
    return;
  }

  try {
    db.run('UPDATE orders SET payment_status = ? WHERE id = ?', [paymentStatus, id]);
    persistDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

if (require.main === module) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch((error) => {
    console.error('Failed to init database:', error);
    process.exit(1);
  });
}

module.exports = app;