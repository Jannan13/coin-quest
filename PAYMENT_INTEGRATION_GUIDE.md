# 💳 Payment Integration Guide - Coin Quest RPG

## 🏦 Payment Processor Options

### 🌟 **Recommended: Stripe** (Most Popular for SaaS)

**Why Stripe:**
- ✅ Built for recurring subscriptions
- ✅ Excellent developer experience
- ✅ Automatic tax handling
- ✅ Global payment methods
- ✅ Strong fraud protection
- ✅ Detailed analytics

**Pricing:**
- 2.9% + $0.30 per transaction
- No monthly fees
- Example: $4.99 subscription = $0.44 fee, you keep $4.55

**Setup Process:**
1. Create Stripe account at https://stripe.com
2. Get API keys (publishable & secret)
3. Set up webhook endpoints
4. Configure subscription products

### 🔄 **Alternative Options**

#### **PayPal Business**
- 2.9% + $0.30 per transaction
- Widely trusted by users
- Good for international payments
- More complex recurring billing setup

#### **Paddle** 
- Merchant of record (they handle taxes)
- 5% + $0.50 per transaction
- Higher fees but handles compliance
- Good for global SaaS

#### **LemonSqueezy**
- Merchant of record like Paddle  
- 5% + $0.50 per transaction
- Developer-friendly
- Handles EU VAT automatically

## 🚀 **Stripe Integration Implementation**

### Step 1: Stripe Account Setup

```bash
# 1. Sign up at https://stripe.com
# 2. Complete business verification
# 3. Get your API keys from Dashboard → Developers → API Keys
```

### Step 2: Install Stripe Dependencies

```bash
npm install stripe
```

### Step 3: Environment Variables

Add to your Cloudflare Pages environment:
```env
STRIPE_PUBLISHABLE_KEY=pk_live_...  # or pk_test_... for testing
STRIPE_SECRET_KEY=sk_live_...       # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...     # For webhook security
```

### Step 4: Create Stripe Products

In your Stripe Dashboard or via API:

```javascript
// Product: Coin Quest RPG Premium
const product = await stripe.products.create({
  name: 'Coin Quest RPG Premium',
  description: 'Complete medieval budget adventure with 180+ rewards'
});

// Price: $4.99/month recurring
const price = await stripe.prices.create({
  product: product.id,
  unit_amount: 499, // $4.99 in cents
  currency: 'usd',
  recurring: {
    interval: 'month'
  }
});
```

### Step 5: Backend Integration

Add these API endpoints to your Hono app:

```typescript
// src/stripe-routes.ts
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Create checkout session
app.post('/api/create-checkout-session', authMiddleware, async (c) => {
  const { env } = c;
  const { user_id, price_id } = await c.req.json();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: price_id, // Your Stripe price ID
        quantity: 1,
      }],
      success_url: `${env.DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.DOMAIN}/pricing`,
      client_reference_id: user_id.toString(),
      customer_email: user.email, // Get from user record
      metadata: {
        user_id: user_id.toString()
      }
    });

    return c.json({ checkout_url: session.url });
  } catch (error) {
    return c.json({ error: 'Payment setup failed' }, 500);
  }
});

// Handle successful payments
app.post('/api/stripe-webhook', async (c) => {
  const { env } = c;
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.text('Webhook signature verification failed', 400);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Update user subscription status
      await env.DB.prepare(`
        UPDATE users 
        SET subscription_status = 'premium',
            stripe_customer_id = ?,
            subscription_ends_at = datetime('now', '+1 month')
        WHERE id = ?
      `).bind(session.customer, session.client_reference_id).run();

      // Record the transaction
      await env.DB.prepare(`
        INSERT INTO payment_transactions 
        (user_id, amount, currency, payment_provider, provider_transaction_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        session.client_reference_id,
        4.99,
        'USD', 
        'stripe',
        session.id,
        'completed'
      ).run();
      break;

    case 'invoice.payment_succeeded':
      // Handle recurring payments
      const invoice = event.data.object;
      // Update subscription end date
      break;

    case 'invoice.payment_failed':
      // Handle failed payments
      const failedInvoice = event.data.object;
      // Maybe downgrade to trial status
      break;
  }

  return c.text('Success');
});
```

### Step 6: Frontend Payment Button

```javascript
// In your pricing section
async function handleSubscribe() {
  try {
    const response = await axios.post('/api/create-checkout-session', {
      user_id: currentUser.id,
      price_id: 'price_1234567890' // Your Stripe price ID
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Redirect to Stripe Checkout
    window.location.href = response.data.checkout_url;
  } catch (error) {
    showError('Payment setup failed. Please try again.');
  }
}
```

## 💰 **Revenue Flow Process**

### Customer Journey
1. **User signs up** → 7-day free trial starts
2. **Trial expires** → Upgrade prompt shown
3. **User clicks "Subscribe"** → Stripe Checkout opens
4. **Payment successful** → Webhook activates premium
5. **Monthly recurring** → Automatic billing

### Money Flow
1. **Customer pays $4.99** → Stripe
2. **Stripe takes fee** (2.9% + $0.30 = $0.44)
3. **You receive $4.55** → Your bank account
4. **Automatic payouts** → Daily or weekly to your bank

## 🔒 **Security & Compliance**

### PCI Compliance
✅ **You're PCI compliant automatically** because:
- Stripe handles all card data
- No card numbers touch your servers
- Stripe Checkout is fully secure

### Required Legal Pages
Update these pages on your site:

```html
<!-- Privacy Policy -->
- How you use customer data
- Stripe data processing
- Cookie usage

<!-- Terms of Service -->
- Subscription terms
- Cancellation policy  
- Refund policy

<!-- Refund Policy -->
- 7-day trial period
- Pro-rated refunds available
- How to request cancellation
```

## 📊 **Revenue Analytics**

### Stripe Dashboard Metrics
- Monthly Recurring Revenue (MRR)
- Customer Lifetime Value (CLV)
- Churn rates
- Failed payment rates
- Revenue growth trends

### Key Metrics to Track
- **Trial → Paid conversion rate**
- **Monthly churn percentage** 
- **Average revenue per user**
- **Customer acquisition cost**

## 🛠️ **Testing Your Integration**

### Test Mode Setup
1. Use Stripe test keys
2. Use test card: `4242 4242 4242 4242`
3. Test successful and failed payments
4. Verify webhook handling

### Production Checklist
- [ ] Live Stripe keys configured
- [ ] Webhook endpoints verified
- [ ] SSL certificate active
- [ ] Privacy policy updated
- [ ] Terms of service ready
- [ ] Refund process documented

## 🎯 **Revenue Projections with Fees**

### Monthly Revenue Breakdown
| Subscribers | Gross Revenue | Stripe Fees | Net Revenue |
|-------------|---------------|-------------|-------------|
| 100         | $499          | $44         | $455        |
| 500         | $2,495        | $220        | $2,275      |
| 1,000       | $4,990        | $440        | $4,550      |
| 2,000       | $9,980        | $880        | $9,100      |

### Annual Projections
- **1,000 subscribers**: $54,600 net revenue/year
- **2,000 subscribers**: $109,200 net revenue/year
- **Effective rate**: 91.2% of gross revenue after fees

## 🚨 **Common Issues & Solutions**

### Failed Payments
```javascript
// Handle in webhook
case 'invoice.payment_failed':
  // Send email reminder
  // Retry payment in 3 days
  // Downgrade after 7 days
```

### Subscription Cancellations
```javascript
// Add cancellation endpoint
app.post('/api/cancel-subscription', authMiddleware, async (c) => {
  const { user_id } = await c.req.json();
  
  // Cancel in Stripe
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true
  });
  
  // Update database
  await env.DB.prepare(`
    UPDATE users 
    SET subscription_status = 'cancelled'
    WHERE id = ?
  `).bind(user_id).run();
});
```

### Refund Processing
```javascript
// Process refund
const refund = await stripe.refunds.create({
  payment_intent: 'pi_...',
  amount: 499, // Full refund
});
```

## 📞 **Next Steps**

### Immediate (This Week)
1. **Sign up for Stripe account**
2. **Complete business verification**
3. **Get API keys**
4. **Test integration in development**

### Short Term (Next 2 Weeks)  
1. **Deploy payment integration**
2. **Test with real payments**
3. **Set up webhook monitoring**
4. **Create legal pages**

### Ongoing
1. **Monitor payment success rates**
2. **Optimize conversion funnel**
3. **Handle customer support**
4. **Scale payment infrastructure**

## 💡 **Pro Tips**

### Increase Conversion
- **Free trial first** (no card required)
- **Clear pricing display**
- **Easy cancellation process**
- **Multiple payment methods**

### Reduce Churn
- **Email payment reminders**
- **Retry failed payments automatically**
- **Offer pause instead of cancel**
- **Exit surveys for cancellations**

---

## 🎯 **Summary**

**Recommended Setup:**
- ✅ **Stripe for payments** (2.9% + $0.30 fee)
- ✅ **Webhook handling** for automation
- ✅ **Test mode first**, then production
- ✅ **Legal compliance** with terms/privacy
- ✅ **Revenue tracking** and analytics

**Expected Net Revenue:**
- 91% of gross after Stripe fees
- $4.55 per $4.99 subscription
- Automatic monthly recurring revenue
- Direct bank account deposits

**Your $4.99 pricing is perfect for Stripe - low enough to reduce payment friction, high enough to be profitable after fees!** 💰🚀