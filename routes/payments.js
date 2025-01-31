// routes/users.js
const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const pool = require(`../db`)
const nodemailer = require('nodemailer');
const functions = require('../helpers/functions')
const gateway = require('../config/braintreeConfig');
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

const stripe = Stripe(process.env.STRIPE_TEST_SECRET_KEY);

router.get('/checkout', async (req, res) => {
    try {
      let description = ''
      let price = ''
        if(Array.isArray(req.query.hour))
        {
            switch(req.query.hour.length){
                case 1:
                  description = 'Pickup Futsal 1 Hour' 
                  price = '10.00'
                    break
                case 2:
                  description = 'Pickup Futsal 2 Hours'
                  price = '15.00'
                    break
                default:
                  // description = 'Pickup Futsal 1 Hour'
                  // price = '10.00'
                    break

            }
        }else{
          description = 'Pickup Futsal 1 Hour'
          price = '10.00'
        }
        // console.log(req)
        await functions.addUserToDatabase(req.query);
        const user = await functions.getUser(req.query)
        // console.log(user)
      const result = await gateway.clientToken.generate({});
      res.render('checkout.ejs', { clientToken: result.clientToken, userId: user.ID, price: price, description: description, hours: req.query.hour, date: req.query.date });
    } catch (error) {
      console.error('Error generating client token:', error);
      res.status(500).send('Error generating client token');
    }
  });
  router.get('/config', (req, res) => {
    res.send({
      publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
    });
  });
  router.get('/test', async (req, res) => {
    try {
    //   const result = await gateway.clientToken.generate({});
    //   res.render('braintreeDropIn.ejs', { clientToken: result.clientToken });
    res.render('customCheckoutStripe.ejs')
    } catch (error) {
      console.error('Error generating client token:', error);
      res.status(500).send('Error generating client token');
    }
  });
  

router.post('/checkout', async (req, res) => {

  try {
        res.render('payment.ejs')
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/venmoCheckout', async (req, res) => {
  try {
    res.render('checkout.ejs')
  } catch (error) {
  res.status(500).json({ error: error.message });
}
})
router.post('/venmoCheckout', async (req, res) => {

  const { paymentMethodNonce, purchaseDetails, itemName, price } = req.body;

  try {
    // Process the payment
    const result = await gateway.transaction.sale({
      amount: price, 
      paymentMethodNonce: paymentMethodNonce,
      lineItems: [
        {
        name: itemName,
        totalAmount: price,
        unitAmount: price,
        kind: 'debit',
        quantity: 1,
        }
      ],
      options: {
        submitForSettlement: true, // Automatically settle the transaction
      },
    });

    if (result.success) {
      // Save purchase details to database (optional)
      console.log('Transaction ID:', result.transaction.id);
      console.log('Purchase Details:', purchaseDetails);

      res.json({ success: true, transactionId: result.transaction.id });
    } else {
      console.error('Transaction failed:', result.message);
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error('Error processing transaction:', err);
    res.status(500).json({ success: false, error: err });
  }
});
// Create payment intent route
router.post('/create-payment-intent', async (req, res) => {

//   const { amount } = req.body || 50;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 50,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
    });
    res.send({ clientSecret: paymentIntent.client_secret });
    // res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/successCash', async (req,res, next)=>{
  try{


      const hoursArray = Array.isArray(req.body.hours) ? req.body.hours : [req.body.hours];
      const hoursString = hoursArray.join(',');
      const request = pool.request()

      let result = await request.query(`
          INSERT into pickupAttendees (userId,pickupId,transactionId,gateway)
          select '${req.body.userId}' as userId,
          id as pickupId,
          'cash' as transactionId,
          'cash' as gateway
          from pickupEvents
          where date = ${req.body.date} and time in (${hoursString})
          AND NOT EXISTS (
              SELECT 1
              FROM pickupAttendees
              WHERE userId = '${req.body.userId}' AND pickupId = pickupEvents.id
          )
          `)
          result = await request.query(`
              select e.*, (select count(a.userId) 
              from pickupAttendees as a
              where e.id=a.pickupId) attendeeCount 
              from pickupEvents as e
              where [date] = ${req.body.date}
              and time in (${hoursString})
              and (select count(a.userId) 
              from pickupAttendees as a
              where e.id=a.pickupId) = totalSlots
          `)
          await fullEmail(result.recordset)
          // IF NOT EXISTS (SELECT 1 FROM users WHERE email = @email)
          // BEGIN
          // END
      // await request.query(`
      //     INSERT into pickupAttendees (userId,pickupId,transactionId)
      //     VALUES()
      // `)
      console.log(result.recordset)
      res.render('paymentSuccess.ejs');
      
  }catch(err){
      next(err)
  }
});
router.post('/successVenmo', async (req,res, next)=>{
  try{


      const hoursArray = Array.isArray(req.body.hours) ? req.body.hours : [req.body.hours];
      const hoursString = hoursArray.join(',');
      const request = pool.request()

      let result = await request.query(`
          INSERT into pickupAttendees (userId,pickupId,transactionId,gateway)
          select '${req.body.userId}' as userId,
          id as pickupId,
          '${req.body.transactionId}' as transactionId,
          'BrainTree' as gateway
          from pickupEvents
          where date = ${req.body.date} and time in (${hoursString})
          AND NOT EXISTS (
              SELECT 1
              FROM pickupAttendees
              WHERE userId = '${req.body.userId}' AND pickupId = pickupEvents.id
          )
          `)
          result = await request.query(`
              select e.*, (select count(a.userId) 
              from pickupAttendees as a
              where e.id=a.pickupId) attendeeCount 
              from pickupEvents as e
              where [date] = ${req.body.date}
              and time in (${hoursString})
              and (select count(a.userId) 
              from pickupAttendees as a
              where e.id=a.pickupId) = totalSlots
          `)
          await fullEmail(result.recordset)
          // IF NOT EXISTS (SELECT 1 FROM users WHERE email = @email)
          // BEGIN
          // END
      // await request.query(`
      //     INSERT into pickupAttendees (userId,pickupId,transactionId)
      //     VALUES()
      // `)
      console.log(result.recordset)
      res.render('paymentSuccess.ejs');
      
  }catch(err){
      next(err)
  }
});
router.get('/success', async (req,res, next)=>{
    try{
        const session = await stripe.checkout.sessions.retrieve(req.query.sessionId);
        console.log(session)

        const hoursArray = Array.isArray(session.metadata.hours) ? session.metadata.hours : [session.metadata.hours];
        const hoursString = hoursArray.join(',');
        const request = pool.request()
        
        let result = await request.query(`
            INSERT into pickupAttendees (userId,pickupId,transactionId)
            select '${session.metadata.userId}' as userId,
            id as pickupId,
            '${session.payment_intent}' as transactionId
            from pickupEvents
            where date = ${session.metadata.date} and time in (${hoursString})
            AND NOT EXISTS (
                SELECT 1
                FROM pickupAttendees
                WHERE userId = '${session.metadata.userId}' AND pickupId = pickupEvents.id
            )
            `)
            result = await request.query(`
                select e.*, (select count(a.userId) 
                from pickupAttendees as a
                where e.id=a.pickupId) attendeeCount 
                from pickupEvents as e
                where [date] = ${session.metadata.date}
                and time in (${hoursString})
                and (select count(a.userId) 
                from pickupAttendees as a
                where e.id=a.pickupId) = totalSlots
            `)
            await fullEmail(result.recordset)
            // IF NOT EXISTS (SELECT 1 FROM users WHERE email = @email)
            // BEGIN
            // END
        // await request.query(`
        //     INSERT into pickupAttendees (userId,pickupId,transactionId)
        //     VALUES()
        // `)
        console.log(result.recordset)
        res.render('paymentSuccess.ejs');
        
    }catch(err){
        next(err)
    }
});
router.get('/cancel', async (req,res, next)=>{
    try{
        const session = await stripe.checkout.sessions.retrieve(req.query.sessionId);
        // console.log(session)

        // const hoursArray = Array.isArray(session.metadata.hours) ? session.metadata.hours : [session.metadata.hours];
        // const hoursString = hoursArray.join(',');
        // const request = pool.request()
        
        // let result = await request.query(`
        //     INSERT into pickupAttendees (userId,pickupId,transactionId)
        //     select '${session.metadata.userId}' as userId,
        //     id as pickupId,
        //     '${session.payment_intent}' as transactionId
        //     from pickupEvents
        //     where date = ${session.metadata.date} and time in (${hoursString})
        //     AND NOT EXISTS (
        //         SELECT 1
        //         FROM pickupAttendees
        //         WHERE userId = '${session.metadata.userId}' AND pickupId = pickupEvents.id
        //     )
        //     `)
        //     result = await request.query(`
        //         select e.*, (select count(a.userId) 
        //         from pickupAttendees as a
        //         where e.id=a.pickupId) attendeeCount 
        //         from pickupEvents as e
        //         where [date] = ${session.metadata.date}
        //         and time in (${hoursString})
        //         and (select count(a.userId) 
        //         from pickupAttendees as a
        //         where e.id=a.pickupId) = totalSlots
        //     `)
        //     await fullEmail(result.recordset)
        //     // IF NOT EXISTS (SELECT 1 FROM users WHERE email = @email)
        //     // BEGIN
        //     // END
        // // await request.query(`
        // //     INSERT into pickupAttendees (userId,pickupId,transactionId)
        // //     VALUES()
        // // `)
        // console.log(result.recordset)
        let data = {
            url: `/pickup/register/${session.metadata.date}`
        }
        res.render('paymentFailure.ejs',{data: data});
        
    }catch(err){
        next(err)
    }
});
// router.get('/', async (req,res, next)=>{
//     try{
//         const stripePublicKey = process.env.STRIPE_LIVE_PUBLISHABLE_KEY
//         res.render('checkoutForm.ejs', { stripePublicKey });
        
//     }catch(err){
//         next(err)
//     }
// });
router.post('/create-checkout-session', async (req, res) => {
    const { email } = req.body;
    console.log(`${req.body.hour}`)
    const referer = req.get('Referer')
    try {
        let priceId = ''
        if(Array.isArray(req.body.hour))
        {
            switch(req.body.hour.length){
                case 1:
                    priceId = 'price_1QVIctFGzuNCeWURECfArCPl' 
                    break
                case 2:
                    priceId = 'price_1QVIcqFGzuNCeWURgegdgjJv'
                    break
                default:
                    priceId = 'price_1QVIctFGzuNCeWURECfArCPl'
                    break

            }
        }else{
            priceId = 'price_1QVIctFGzuNCeWURECfArCPl'
        }
        console.log(JSON.stringify(req.body.hour))
        await functions.addUserToDatabase(req.body);
        const user = await functions.getUser(req.body)
        console.log(user)
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
                hours: `${req.body.hour}`,
                userId: `${user.ID}`,
                date: `${req.body.date}`
              },
            success_url: `${req.headers.origin}/api/payments/success?sessionId={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/api/payments/cancel?sessionId={CHECKOUT_SESSION_ID}&url=${referer}` ,
        });
        console.log(session)
        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
async function fullEmail(recordset){
    for(let i=0;i<recordset.length;i++){
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            service: 'gmail',
            secure: false,
            auth: {
               user: process.env.ORG_EMAIL,
               pass: process.env.ORG_EMAIL_PASSWORD
            },
            debug: false,
            logger: true
        });
    
        
        const mailOptions = {
          from: process.env.ORG_EMAIL,
          to: process.env.PICKUP_ALERT_EMAIL,
          subject: 'Pickup Full',
          text: `Pickup Full:
          Date: ${functions.formatDate(recordset[i].date) }
          Time: ${functions.millisecondsToTimeString(recordset[i].time)}`,
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.error('Error sending pickup full email:', error);
          }
          console.log('Pickup Full Email Sent:', info.response);
          return res.redirect('/')
    
        });
    }
    
}
// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
