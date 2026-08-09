const productKey = 'novacart_products';
const orderKey = 'novacart_orders';
const cartKey = 'novacart_cart';
const customerPhoneKey = 'novacart_customer_phone';

const state = {
  cart: JSON.parse(localStorage.getItem(cartKey) || '{}')
};

function getProducts() {
  try {
    const stored = localStorage.getItem(productKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem(productKey, JSON.stringify(products));
}

function getOrders() {
  try {
    const stored = localStorage.getItem(orderKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(orderKey, JSON.stringify(orders));
}

function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(state.cart));
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function getCustomerPhone() {
  return sessionStorage.getItem(customerPhoneKey) || '';
}

function saveCustomerPhone(value) {
  sessionStorage.setItem(customerPhoneKey, value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function productById(productId) {
  return getProducts().find(product => product.id === productId);
}

async function loadProductsFromApi() {
  try {
    const response = await fetch('/api/products');
    const products = await response.json();
    if (!response.ok) throw new Error(products.error || 'Failed to load products');
    saveProducts(products);
    renderProducts();
  } catch (error) {
    console.error(error);
    renderProducts();
  }
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const products = getProducts();

  if (!products.length) {
    grid.innerHTML = '<div class="empty-state">No products available yet.</div>';
    return;
  }

  grid.innerHTML = products
    .map(
      product => `
        <article class="product-card">
          <div class="product-image">
            <img src="${product.image_url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80'}" alt="${product.name}" />
          </div>
          <div class="product-body">
            <div class="product-meta">
              <span class="category">${product.category || 'General'}</span>
              <span>${product.id}</span>
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="product-footer">
              <strong>${formatCurrency(product.price)}</strong>
              <button class="add-btn" data-add="${product.id}">Add to cart</button>
            </div>
          </div>
        </article>
      `
    )
    .join('');

  document.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => {
      addToCart(button.dataset.add);
    });
  });
}

function addToCart(productId) {
  const product = productById(productId);
  if (!product) return;

  state.cart[productId] = (state.cart[productId] || 0) + 1;
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  saveCart();
  renderCart();
}

function updateCartQty(productId, delta) {
  const currentQty = state.cart[productId] || 0;
  const nextQty = currentQty + delta;

  if (nextQty <= 0) {
    removeFromCart(productId);
    return;
  }

  state.cart[productId] = nextQty;
  saveCart();
  renderCart();
}

function renderCustomerOrders(orders = []) {
  const customerOrders = document.getElementById('customerOrders');
  if (!customerOrders) return;

  const customerPhone = normalizePhone(getCustomerPhone());
  if (!customerPhone) {
    customerOrders.innerHTML = '<div class="empty-state">Sign in with your mobile number to see your orders.</div>';
    return;
  }

  const filteredOrders = (orders || []).filter(order => normalizePhone(order.phone || order.customer_phone || '') === customerPhone);

  if (!filteredOrders.length) {
    customerOrders.innerHTML = '<div class="empty-state">You have no orders yet.</div>';
    return;
  }

  customerOrders.innerHTML = filteredOrders
    .slice(0, 5)
    .map(order => {
      const itemList = (Array.isArray(order.items) ? order.items : []).map(item => `${item.name} x ${item.qty}`).join(', ') || 'No items';
      const paymentStatus = order.payment_status || 'Unpaid';
      return `
        <div class="customer-order-item">
          <strong>${order.id}</strong>
          <span>${itemList}</span><br />
          <small>${order.status || 'New'} · ${formatCurrency(order.total || 0)}</small><br />
          <small>Payment: ${paymentStatus}</small>
        </div>
      `;
    })
    .join('');
}

async function loadCustomerOrders() {
  const customerPhone = normalizePhone(getCustomerPhone());
  const customerOrders = document.getElementById('customerOrders');
  if (!customerOrders) return;

  if (!customerPhone) {
    renderCustomerOrders([]);
    return;
  }

  try {
    const response = await fetch(`/api/orders?phone=${encodeURIComponent(customerPhone)}`);
    const orders = await response.json();
    if (!response.ok) throw new Error(orders.error || 'Failed to load orders');
    renderCustomerOrders(orders);
  } catch (error) {
    console.error(error);
    renderCustomerOrders([]);
  }
}

function toggleCheckoutVisibility() {
  const checkoutPanel = document.getElementById('checkoutPanel');
  const accessBox = document.getElementById('checkoutAccessBox');
  const customerPhone = normalizePhone(getCustomerPhone());
  const hasItems = Object.keys(state.cart).length > 0;

  if (checkoutPanel) {
    checkoutPanel.hidden = !(customerPhone && hasItems);
  }

  if (accessBox) {
    accessBox.hidden = !(hasItems && !customerPhone);
  }
}

function revealCheckoutLogin() {
  const accessBox = document.getElementById('checkoutAccessBox');
  const customerPhoneInput = document.getElementById('customerPhoneInput');

  if (accessBox) {
    accessBox.hidden = false;
  }

  if (customerPhoneInput) {
    customerPhoneInput.focus();
  }
}

function renderCart() {
  const cartItems = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('subtotalValue');
  const totalEl = document.getElementById('totalValue');
  const cartCount = document.getElementById('cartCount');

  if (!cartItems || !subtotalEl || !totalEl || !cartCount) return;

  toggleCheckoutVisibility();

  const products = getProducts();
  const cartEntries = Object.entries(state.cart);

  if (!cartEntries.length) {
    cartItems.innerHTML = '<div class="empty-state">Your cart is empty.</div>';
    subtotalEl.textContent = formatCurrency(0);
    totalEl.textContent = formatCurrency(0);
    cartCount.textContent = '0 items';
    return;
  }

  const itemRows = cartEntries
    .map(([productId, qty]) => {
      const product = products.find(item => item.id === productId);
      if (!product) return '';

      const itemTotal = product.price * qty;
      return `
        <div class="cart-item">
          <div>
            <span class="item-name">${product.name}</span>
            <div class="item-meta">
              <span>${formatCurrency(product.price)}</span>
              <div class="qty-controls">
                <button type="button" data-decrease="${product.id}">-</button>
                <span>${qty}</span>
                <button type="button" data-increase="${product.id}">+</button>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <strong>${formatCurrency(itemTotal)}</strong>
            <button type="button" class="item-remove" data-remove="${product.id}">Remove</button>
          </div>
        </div>
      `;
    })
    .join('');

  cartItems.innerHTML = itemRows;

  const subtotal = cartEntries.reduce((sum, [productId, qty]) => {
    const product = products.find(item => item.id === productId);
    return sum + (product ? product.price * qty : 0);
  }, 0);

  const total = subtotal;
  const totalItems = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);

  subtotalEl.textContent = formatCurrency(subtotal);
  totalEl.textContent = formatCurrency(total);
  cartCount.textContent = `${totalItems} item${totalItems === 1 ? '' : 's'}`;

  toggleCheckoutVisibility();

  document.querySelectorAll('[data-increase]').forEach(button => {
    button.addEventListener('click', () => updateCartQty(button.dataset.increase, 1));
  });

  document.querySelectorAll('[data-decrease]').forEach(button => {
    button.addEventListener('click', () => updateCartQty(button.dataset.decrease, -1));
  });

  document.querySelectorAll('[data-remove]').forEach(button => {
    button.addEventListener('click', () => removeFromCart(button.dataset.remove));
  });

  const hasItems = Object.keys(state.cart).length > 0;
  const checkoutSigninButton = document.getElementById('checkoutSigninButton');
  if (checkoutSigninButton) {
    checkoutSigninButton.hidden = !hasItems || normalizePhone(getCustomerPhone()) !== '';
  }
}

async function handleCheckout(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const cartEntries = Object.entries(state.cart);

  if (!cartEntries.length) {
    showMessage('Your cart is empty before placing an order.', 'error');
    return;
  }

  const fullName = form.fullName.value.trim();
  const phone = form.phone.value.trim();
  const email = form.email.value.trim();
  const address = form.address.value.trim();
  const notes = form.notes.value.trim();

  if (phone) {
    saveCustomerPhone(phone);
  }

  if (!fullName || !phone || !email || !address) {
    showMessage('Please complete all required checkout fields.', 'error');
    return;
  }

  const products = getProducts();
  const items = cartEntries.map(([productId, qty]) => {
    const product = products.find(item => item.id === productId);
    return {
      productId,
      name: product ? product.name : 'Unknown product',
      qty,
      price: product ? product.price : 0
    };
  });

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { fullName, phone, email },
        address,
        notes,
        items
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Checkout failed');

    state.cart = {};
    saveCart();
    renderCart();
    form.reset();
    const phoneValue = normalizePhone(phone);
    if (phoneValue) {
      const phoneInput = document.querySelector('input[name="phone"]');
      if (phoneInput) {
        phoneInput.value = phoneValue;
      }
    }
    showMessage(result.message || 'Order placed successfully. Please check the admin dashboard.', 'success');
    saveOrders([...(getOrders() || []), { id: result.orderId, customer_name: fullName, email, phone: phoneValue, total: items.reduce((sum, item) => sum + item.price * item.qty, 0), status: 'New', address, items }]);
    await loadCustomerOrders();
  } catch (error) {
    showMessage(error.message || 'Something went wrong while placing the order.', 'error');
  }
}

function showMessage(message, type) {
  const messageEl = document.getElementById('orderMessage');
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.className = `form-message ${type}`;
}

function attachFeatureButton() {
  const featuredButton = document.querySelector('[data-add="earbuds"]');
  if (featuredButton) {
    featuredButton.addEventListener('click', () => addToCart('earbuds'));
  }
}

function handleCustomerLogin(event) {
  event.preventDefault();

  const phoneInput = document.getElementById('customerPhoneInput');
  const status = document.getElementById('customerLoginStatus');
  const phone = normalizePhone(phoneInput.value || '');

  if (!phone) {
    if (status) {
      status.textContent = 'Please enter a valid mobile number.';
      status.style.color = '#f15b5b';
    }
    return;
  }

  saveCustomerPhone(phone);
  const checkoutPhoneInput = document.querySelector('input[name="phone"]');
  if (checkoutPhoneInput) {
    checkoutPhoneInput.value = phone;
  }

  if (status) {
    status.textContent = `Signed in as ${phone}`;
    status.style.color = '#1bbf73';
  }

  toggleCheckoutVisibility();
  loadCustomerOrders();
}

function initStorefront() {
  loadProductsFromApi();
  renderCart();
  attachFeatureButton();

  const customerPhone = normalizePhone(getCustomerPhone());
  const customerPhoneInput = document.getElementById('customerPhoneInput');
  const checkoutPhoneInput = document.querySelector('input[name="phone"]');

  if (customerPhoneInput && customerPhone) {
    customerPhoneInput.value = customerPhone;
  }

  if (checkoutPhoneInput && customerPhone) {
    checkoutPhoneInput.value = customerPhone;
  }

  toggleCheckoutVisibility();

  const customerLoginForm = document.getElementById('customerLoginForm');
  if (customerLoginForm) {
    customerLoginForm.addEventListener('submit', handleCustomerLogin);
  }

  const checkoutSigninButton = document.getElementById('checkoutSigninButton');
  if (checkoutSigninButton) {
    checkoutSigninButton.addEventListener('click', revealCheckoutLogin);
  }

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckout);
  }

  loadCustomerOrders();
}

document.addEventListener('DOMContentLoaded', initStorefront);
