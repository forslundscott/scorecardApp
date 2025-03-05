// routes/users.js
const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const pool = require(`../db`)
const nodemailer = require('nodemailer');
const functions = require('../helpers/functions')
const gateway = require('../config/braintreeConfig');
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// async function createCheckoutSession({ email, hours, date, origin, referer, priceId, userId }) {
//   try {
      
//       // Create Stripe Checkout session
//       const session = await stripe.checkout.sessions.create({
//           line_items: [
//               {
//                   price: priceId,
//                   quantity: 1,
//               },
//           ],
//           customer_email: email,
//           mode: 'payment',
//           metadata: {
//               hours: `${hours}`,
//               userId: `${userId}`,
//               date: `${date}`,
//           },
//           success_url: `${origin}/api/payments/success?sessionId={CHECKOUT_SESSION_ID}`,
//           cancel_url: `${origin}/api/payments/cancel?sessionId={CHECKOUT_SESSION_ID}&url=${referer}`,
//       });

//       return session;
//   } catch (error) {
//       throw new Error(error.message);
//   }
// }


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
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  });
  router.get('/test', async (req, res) => {
    try {
      throw new Error("This is a test error")
    //   const result = await gateway.clientToken.generate({});
    //   res.render('braintreeDropIn.ejs', { clientToken: result.clientToken });
    // res.render('customCheckoutStripe.ejs')
    } catch (error) {
      functions.failedQuery({test: 'test'} ,error)
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
      const session = await stripe.checkout.sessions.retrieve(req.query.sessionId)
        fetch(`${req.protocol}://${req.get('host')}/seasons/${session.metadata.seasonId}/registration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ sessionId: req.query.sessionId }).toString(),
        })
          .then(response => response.json())
          .then(data => {
            console.log('Payment processed successfully:', data);
          })
          .catch(error => {
            console.error('Error processing payment:', error);
          });
        // this is all for pickup. Move to another route
        // const session = await stripe.checkout.sessions.retrieve(req.query.sessionId);
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
            
        // console.log(result.recordset)
        res.render('paymentSuccess.ejs');
        
    }catch(err){
        next(err)
    }
});
router.get('/cancel', async (req,res, next)=>{
    try{
        // const session = await stripe.checkout.sessions.retrieve(req.query.sessionId);
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
            // url: `/pickup/register/${session.metadata.date}`
            url: req.query.url || 'https://envoroot.com'
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
router.post('/individualSeasonCheckoutSession', async (req, res) => {
  
  try {
    const transformedBody = Object.fromEntries(
      Object.entries(req.body).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value,
      ])
    );
    const product = await stripe.products.search({
        query: `name:'6 Game Season'`,
    })
    const metadata = {
      type: 'individualSeasonCheckout',
      priceId: product.data[0].default_price,
      success_url: `${req.headers.origin}/api/payments/success?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/api/payments/cancel?sessionId={CHECKOUT_SESSION_ID}&url=${req.get('Referer') || 'https://envoroot.com'}`,
      ...transformedBody
    }
    // console.log(product.data[0].default_price)
    let leaguesTeams = [];

    Object.keys(req.body).forEach(key => {
        if (key.includes('leagueId_')) {
            let remainingKey = key.replace('leagueId_', ''); // Remove 'leagueId_'
            
            // Find another key that contains the remaining part
            let matchingKey = Object.keys(req.body).find(k => k.includes(remainingKey) && k !== key);

            if (matchingKey) {
                leaguesTeams.push({
                    leagueId: remainingKey,
                    teamId: req.body[matchingKey]
                });
            }
        }
    });
    metadata.quantity = leaguesTeams.length
    metadata.leaguesTeams = JSON.stringify(leaguesTeams)
    console.log(metadata)
      // let priceId = 'price_1QRdBOFGzuNCeWURG6JFGgYi';
      // if (Array.isArray(req.body.hour)) {
      //   switch(req.body.hour.length){
      //     case 2:
      //       priceId = process.env.STRIPE_INDIVIDUAL_SEASON_PRICE_2LEAGUE
      //       break
      //     case 3:
      //       priceId = process.env.STRIPE_INDIVIDUAL_SEASON_PRICE_3LEAGUE
      //       break
      //     case 4:
      //       priceId = process.env.STRIPE_INDIVIDUAL_SEASON_PRICE_4LEAGUE
      //       break
      //   }
      // }
      await functions.addUserToDatabase(req.body);
      const user = await functions.getUser(req.body)
      metadata.userId = user.ID
      const session = await functions.createCheckoutSession({
        metadata
    });
    console.log('checkout')
      res.json({ url: session.url });
  } catch (error) {
    console.log(error)
      res.status(500).json({ error: error.message });
  }
});
router.post('/pickupCheckoutSession', async (req, res) => {

  const metadata = {
    email: req.body.email,
    hours: req.body.hour,
    date: req.body.date,
    success_url: `${req.headers.origin}/api/payments/success?sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.origin}/api/payments/cancel?sessionId={CHECKOUT_SESSION_ID}&url=${req.get('Referer')}`,
    quantity: 1
  }
  
  try {
      metadata.priceId = process.env.STRIPE_PICKUP_PRICE_1HR;
      if (Array.isArray(metadata.hours) && metadata.hours.length === 2) {
          metadata.priceId = process.env.STRIPE_PICKUP_PRICE_2HR;
      }
      await functions.addUserToDatabase(req.body);
      const user = await functions.getUser(req.body)
      metadata.userId = user.ID
      console.log(metadata)
      const session = await functions.createCheckoutSession({
        metadata
    });
      res.json({ url: session.url });
  } catch (error) {
    console.log(error)
      res.status(500).json({ error: error.message });
  }
});
router.post('/create-checkout-session', async (req, res) => {
    const { email } = req.body;
    const referer = req.get('Referer')
    try {
        let priceId = process.env.STRIPE_PICKUP_PRICE_1HR;
        if (Array.isArray(req.body.hour) && req.body.hour.length === 2) {
            priceId = process.env.STRIPE_PICKUP_PRICE_2HR;
        }
        await functions.addUserToDatabase(req.body);
        const user = await functions.getUser(req.body)
        const session = await functions.createCheckoutSession({
          email,
          hours: req.body.hour,
          date: req.body.date,
          origin: req.headers.origin,
          referer,
          priceId,
          userId: user.ID
      });
        res.json({ url: session.url });
    } catch (error) {
      console.log(error)
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

module.exports = router;
