// routes/users.js
const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

const stripe = Stripe(process.env.STRIPE_TEST_SECRET_KEY);

// Create payment intent route
router.post('/create-payment-intent', async (req, res) => {
    console.log(req.body)
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
    });
    
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/success', async (req,res, next)=>{
    try{
        
        res.render('paymentSuccess.ejs');
        // res.render('payment.ejs', { stripePublicKey });
    }catch(err){
        next(err)
    }
});
router.get('/', async (req,res, next)=>{
    try{
        const stripePublicKey = process.env.STRIPE_TEST_PARISHABLE_KEY
        res.render('checkoutForm.ejs', { stripePublicKey });
        // res.render('payment.ejs', { stripePublicKey });
    }catch(err){
        next(err)
    }
});
router.post('/create-checkout-session', async (req, res) => {
    const { amount, currency = 'usd', email } = req.body;
    console.log(req.body.hour.length)
    try {
        var priceId = ''
        switch(req.body.hour.length){
            case 1:
                priceId = 'price_1QRQwYFGzuNCeWURftUafpEX'
                break
            case 2:
                priceId = 'price_1QRQzpFGzuNCeWUR7QZ81kCi'
                break
            default:
                priceId = 'price_1QRQwYFGzuNCeWURftUafpEX'
                break

        }
        console.log(req.body)
        await functions.addUserToDatabase(req.body);
        const userId = functions.getUser(req.body)
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    // price_data: {
                    //     currency: currency,
                    //     product_data: {
                    //         name: 'Sample Product',
                    //     },
                    //     unit_amount: amount,
                    // },
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: email,
            mode: 'payment', // For one-time payments
            metadata: {
                hours: JSON.stringify(req.body.hour),
                userId: `${userId}`,
                date: `${req.body.date}`
              },
            success_url: `${req.headers.origin}/api/payments/success`,
            cancel_url: req.get('Referer') || 'https://example.com',
        });
        // console.log(session)
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
