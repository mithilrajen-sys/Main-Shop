const adminKey = 'novacart_admin_session';
const adminEmail = 'admin@myshop.com';
const adminPassword = 'admin123';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function getProducts() {
  try {
    const stored = localStorage.getItem('novacart_products');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem('novacart_products', JSON.stringify(products));
}

function getOrders() {
  try {
    const stored = localStorage.getItem('novacart_orders');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem('novacart_orders', JSON.stringify(orders));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function isLoggedIn() {
  return localStorage.getItem(adminKey) === 'true';
}

function setLoggedIn(value) {
  localStorage.setItem(adminKey, value ? 'true' : 'false');
}

function showLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('adminSection').classList.add('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
}

function showAdmin() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('adminSection').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
}

async function loadAdminData() {
  try {
    const [products, orders] = await Promise.all([
      fetchJson('/api/products'),
      fetchJson('/api/orders')
    ]);

    saveProducts(products);
    saveOrders(orders);
    renderStats();
    renderOrders();
    renderProductsList();
  } catch (error) {
    console.error(error);
    renderStats();
    renderOrders();
    renderProductsList();
  }
}

function renderStats() {
  const orders = getOrders();
  const products = getProducts();

  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pending = orders.filter(order => order.status !== 'Delivered').length;

  document.getElementById('statRevenue').textContent = formatCurrency(revenue);
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statProducts').textContent = products.length;
  document.getElementById('statPending').textContent = pending;
}

function renderOrders() {
  const orders = getOrders();
  const ordersTable = document.getElementById('ordersTable');

  if (!orders.length) {
    ordersTable.innerHTML = '<div class="empty-state">No orders yet.</div>';
    return;
  }

  ordersTable.innerHTML = orders
    .map(order => {
      const itemCount = Array.isArray(order.items) ? order.items.length : (JSON.parse(order.items || '[]')).length;
      const paymentStatus = order.payment_status || 'Unpaid';
      return `
        <div class="order-row">
          <div>
            <strong>${order.id}</strong>
            <small>${order.customer_name || 'Customer'}</small>
          </div>
          <div>
            <span>${itemCount} items</span><br />
            <strong>${formatCurrency(order.total || 0)}</strong>
          </div>
          <div>
            <small>${order.email || 'No email'}</small><br />
            <small>${order.address || 'No address'}</small>
          </div>
          <div>
            <select class="status-select" data-order-id="${order.id}">
              <option value="New" ${order.status === 'New' ? 'selected' : ''}>New</option>
              <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            </select>
            <select class="payment-select" data-order-id="${order.id}">
              <option value="Unpaid" ${paymentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="Paid" ${paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
            </select>
          </div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', async (event) => {
      const { orderId } = event.target.dataset;

      try {
        await fetchJson(`/api/orders/${orderId}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: event.target.value })
        });

        const orders = getOrders().map(order => {
          if (order.id === orderId) {
            return { ...order, status: event.target.value };
          }
          return order;
        });

        saveOrders(orders);
        renderStats();
        renderOrders();
      } catch (error) {
        console.error(error);
      }
    });
  });

  document.querySelectorAll('.payment-select').forEach(select => {
    select.addEventListener('change', async (event) => {
      const { orderId } = event.target.dataset;

      try {
        await fetchJson(`/api/orders/${orderId}/payment-status`, {
          method: 'POST',
          body: JSON.stringify({ paymentStatus: event.target.value })
        });

        const orders = getOrders().map(order => {
          if (order.id === orderId) {
            return { ...order, payment_status: event.target.value };
          }
          return order;
        });

        saveOrders(orders);
        renderOrders();
      } catch (error) {
        console.error(error);
      }
    });
  });
}

function renderProductsList() {
  const products = getProducts();
  const productList = document.getElementById('productList');

  if (!products.length) {
    productList.innerHTML = '<div class="empty-state">No products in the catalog.</div>';
    return;
  }

  productList.innerHTML = products
    .map(
      product => `
        <div class="product-row">
          <div>
            <strong>${product.name}</strong><br />
            <small>${product.category} · ${formatCurrency(product.price)}</small>
          </div>
          <button type="button" class="delete-product" data-product-id="${product.id}">Delete</button>
        </div>
      `
    )
    .join('');

  document.querySelectorAll('.delete-product').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        await fetchJson(`/api/products/${button.dataset.productId}`, {
          method: 'DELETE'
        });

        const nextProducts = getProducts().filter(product => product.id !== button.dataset.productId);
        saveProducts(nextProducts);
        renderProductsList();
        renderStats();
      } catch (error) {
        console.error(error);
      }
    });
  });
}

function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const messageEl = document.getElementById('loginMessage');

  if (email === adminEmail && password === adminPassword) {
    setLoggedIn(true);
    messageEl.textContent = 'Login successful.';
    messageEl.className = 'form-message success';
    renderAdminDashboard();
    return;
  }

  messageEl.textContent = 'Incorrect email or password.';
  messageEl.className = 'form-message error';
}

async function handleProductSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('productName').value.trim();
  const price = Number(document.getElementById('productPrice').value);
  const category = document.getElementById('productCategory').value.trim();
  const description = document.getElementById('productDescription').value.trim();
  const imageUrl = `https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80`;

  if (!name || !category || !description || Number.isNaN(price) || price <= 0) {
    return;
  }

  const product = {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `product-${Date.now()}`,
    name,
    category,
    description,
    price,
    image_url: imageUrl
  };

  try {
    const response = await fetchJson('/api/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });

    const nextProducts = [response.product, ...getProducts()];
    saveProducts(nextProducts);

    event.currentTarget.reset();
    renderProductsList();
    renderStats();
  } catch (error) {
    console.error(error);
  }
}

function handleLogout() {
  setLoggedIn(false);
  showLogin();
  document.getElementById('loginForm').reset();
  const messageEl = document.getElementById('loginMessage');
  messageEl.textContent = '';
  messageEl.className = 'form-message';
}

function renderAdminDashboard() {
  showAdmin();
  loadAdminData();
}

function initAdmin() {
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const productForm = document.getElementById('productForm');

  if (isLoggedIn()) {
    renderAdminDashboard();
  } else {
    showLogin();
  }

  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  productForm.addEventListener('submit', handleProductSubmit);
}

document.addEventListener('DOMContentLoaded', initAdmin);
