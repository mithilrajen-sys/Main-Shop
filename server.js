const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3000;

// In-memory data store for serverless environment
let products = [
  { id: 'earbuds', name: 'Premium Wireless Earbuds', category: 'Audio', description: 'Rich sound, deep bass, and all-day comfort for busy lifestyles.', price: 89, image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() },
  { id: 'watch', name: 'Smart Fitness Watch', category: 'Wearables', description: 'Track workouts, heart rate, and notifications in one sleek device.', price: 129, image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() },
  { id: 'lamp', name: 'LED Desk Lamp', category: 'Home', description: 'Modern lighting with adjustable brightness for productivity and comfort.', price: 54, image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() },
  { id: 'backpack', name: 'Urban Travel Backpack', category: 'Accessories', description: 'Water-resistant storage with laptop sleeve and ergonomic straps.', price: 72, image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() },
  { id: 'speaker', name: 'Portable Bluetooth Speaker', category: 'Audio', description: 'Punchy sound and durable design for songs at home or outdoors.', price: 64, image_url: 'https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() },
  { id: 'coffee', name: 'Premium Coffee Kit', category: 'Lifestyle', description: 'Everything needed for a café-style brew at home or the office.', price: 48, image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', created_at: new Date().toISOString() }
];

let orders = [];

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/products', (req, res) => {
  const { id, name, category, description, price, image_url } = req.body;
  if (!id || !name || !category || !description || !price) {
    return res.status(400).json({ error: 'Missing required product fields.' });
  }
  const newProduct = { id, name, category, description, price: Number(price), image_url: image_url || '', created_at: new Date().toISOString() };
  products.unshift(newProduct);
  res.json({ success: true, product: newProduct });
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  products = products.filter(p => p.id !== id);
  res.json({ success: true });
});

app.get('/api/orders', (req, res) => {
  res.json(orders);
});

app.post('/api/checkout', (req, res) => {
  const { customer, address, notes, items } = req.body;
  if (!customer || !address || !items || !items.length) {
    return res.status(400).json({ error: 'Missing checkout details.' });
  }

  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const orderId = `ORD-${Date.now()}`;
  const newOrder = {
    id: orderId,
    customer_name: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    address,
    notes: notes || '',
    items,
    total,
    status: 'New',
    payment_status: 'Unpaid',
    created_at: new Date().toISOString()
  };

  orders.unshift(newOrder);
  res.json({ success: true, orderId, message: 'Order created successfully.' });
});

app.post('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) order.status = status;
  res.json({ success: true });
});

app.post('/api/orders/:id/payment-status', (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) order.payment_status = paymentStatus;
  res.json({ success: true });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
