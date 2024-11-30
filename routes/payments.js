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

router.get('/', async (req,res, next)=>{
    try{
        const stripePublicKey = process.env.STRIPE_TEST_PARISHABLE_KEY
        res.render('payment.ejs', { stripePublicKey });
    }catch(err){
        next(err)
    }
});

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
