# NovaCart Store

A simple e-commerce website with a customer storefront and admin dashboard.

## Features
- Product catalog with images
- Cart and checkout flow
- Online payment readiness via Stripe
- Order notifications via email and WhatsApp
- SQLite database for persistent storage
- Admin dashboard for products and order status

## Run locally

1. Install dependencies:
   npm install
2. Copy the environment file:
   copy .env.example .env
3. Start the server:
   npm start
4. Open:
   - http://localhost:3000/
   - http://localhost:3000/admin

## Admin login
- Email: admin@myshop.com
- Password: admin123

## Notes
- Payment and notification services are optional. Fill in the keys in .env to enable them.
- If Stripe or email/WhatsApp credentials are missing, the app still works for offline testing.
