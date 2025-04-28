// routes/users.js
const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const pool = require(`../db`)
const sql = require('mssql'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Blob } = require('buffer');
const nodemailer = require('nodemailer');
const functions = require('../helpers/functions')
const gateway = require('../config/braintreeConfig');
const { Readable } = require('stream');
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
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
    let data = {
            body: req.body,
            path: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
            user: req.user
        }
    let transaction
    let isTransactionActive = false
  try{
      const session = await stripe.checkout.sessions.retrieve(req.query.sessionId)
      console.log(session)
      if (session.metadata.type === 'individualSeasonCheckout') {
              console.log('indiv')

            data.metadata = session.metadata

            let leaguesTeams = JSON.parse(session.metadata.leaguesTeams);
        console.log('session')
        transaction = new sql.Transaction(pool);
        console.log('trans')
        data.leaguesTeams = leaguesTeams
            // Begin the transaction
            await transaction.begin();
          console.log(session.id)
            isTransactionActive = true
        const result = await new sql.Request(transaction)
                .input('seasonId', sql.Int, session.metadata.seasonId)
                .input('userId', sql.Int, req.user.id)
                .input('registrationTime', sql.BigInt, Date.now())
                .input('transactionId', sql.VarChar, session.id)
                .input('gateway', sql.VarChar, 'Stripe')
                .input('keeperShirtColor', sql.VarChar, session.metadata.keeperShirtColor || '')
                .input('test', sql.Bit, !session.livemode)
                .input('type', sql.VarChar, 'individual')
                .query(`
                    INSERT INTO seasonRegistrations (seasonId, registrationTime, userId, transactionId, gateway, keeperColor, test, type)
                    OUTPUT INSERTED.registrationId
                    VALUES (@seasonId, @registrationTime, @userId, @transactionId, @gateway, @keeperShirtColor, @test, @type)
                `);

            const registrationId = result.recordset[0].registrationId;
            data.registrationId = registrationId
            console.log('Registration inserted, registrationId:', registrationId);
                  console.log('first')

            for (const item of leaguesTeams) {
                await new sql.Request(transaction)
                    .input('registrationId', sql.Int, registrationId)
                    .input('userId', sql.Int, req.user.id)
                    .input('leagueId', sql.VarChar, item.leagueId)
                    .input('teamId', sql.VarChar, item.teamId)
                    .input('seasonId', sql.Int, session.metadata.seasonId)
                    .input('division', sql.VarChar, item.division)
                    .input('keeper', sql.Bit, ['true', true, 1, '1'].includes(session.metadata.keeper) ? 1 : 0)
                    .input('test', sql.Bit, !session.livemode)
                    .input('paid', sql.Bit, 1)
                    .input('shirtSize', sql.VarChar(10), String(session.metadata.shirtSize))
                    .query(`
                        INSERT INTO seasonRegistration_leagueTeam (registrationId, leagueId, teamId, userId, seasonId, test, division, keeper, paid, shirtSize)
                        VALUES (@registrationId, @leagueId, @teamId, @userId, @seasonId, @test, @division, @keeper, @paid, @shirtSize)
                    `);
            }
            console.log('second')
            if(session.metadata.waiverPaid){
              await new sql.Request(transaction)
                    .input('waiverPayDate', sql.BigInt, Date.now())
                    .input('userId', sql.Int, req.user.id)
                    .query(`
                      update users
                      set waiverPayDate = @waiverPayDate
                      where ID = @userId
                      `)
            }

            await transaction.commit()
            isTransactionActive = false

      }else if (session.metadata.type === 'teamSeasonCheckout') {
        console.log('team')
        console.log(session.metadata)
        if(session.metadata.teamType === 'new'){
          functions.commitTeam(parseInt(session.metadata.teamId))
        }
        functions.assignTeam(parseInt(session.metadata.seasonId),parseInt(session.metadata.leagueId),parseInt(session.metadata.teamId))
        transaction = new sql.Transaction(pool);
        
            // Begin the transaction
            await transaction.begin();
            isTransactionActive = true
        const result = await new sql.Request(transaction)
                .input('seasonId', sql.Int, session.metadata.seasonId)
                .input('userId', sql.Int, req.user.id)
                .input('registrationTime', sql.BigInt, Date.now())
                .input('transactionId', sql.VarChar, session.id)
                .input('gateway', sql.VarChar, 'Stripe')
                .input('keeperShirtColor', sql.VarChar, session.metadata.keeperShirtColor || '')
                .input('teamShirtColor1', sql.VarChar, session.metadata.teamShirtColor1 || '')
                .input('teamShirtColor2', sql.VarChar, session.metadata.teamShirtColor2 || '')
                .input('teamShirtColor3', sql.VarChar, session.metadata.teamShirtColor3 || '')
                .input('teamId', sql.Int, parseInt(session.metadata.teamId))
                .input('leagueId', sql.Int, session.metadata.leagueId)
                .input('division', sql.VarChar, session.metadata.division)
                .input('teamSkill', sql.Int, session.metadata.skill)
                .input('test', sql.Bit, !session.livemode)
                .input('captainId', sql.Int, session.metadata.captainId || req.user.id)
                .input('keeperId', sql.Int, session.metadata.keeperId || req.user.id)
                .input('type', sql.VarChar, session.metadata.teamPayType === 'self' ? 'captain' : 'team')
                .query(`
                    INSERT INTO seasonRegistrations (
                      seasonId
                      , registrationTime
                      , userId
                      , transactionId
                      , gateway
                      , keeperColor
                      , test
                      , teamColor1
                      , teamColor2
                      , teamColor3
                      , teamId
                      , leagueId
                      , division
                      , teamSkill
                      , captainId
                      , keeperId
                      , type
                    )
                    OUTPUT INSERTED.registrationId
                    VALUES (
                      @seasonId
                      , @registrationTime
                      , @userId
                      , @transactionId
                      , @gateway
                      , @keeperShirtColor
                      , @test
                      , @teamShirtColor1
                      , @teamShirtColor2
                      , @teamShirtColor3
                      , @teamId
                      , @leagueId
                      , @division
                      , @teamSkill
                      , @captainId
                      , @keeperId
                      , @type
                    )
                `);

            const registrationId = result.recordset[0].registrationId;
            console.log('Registration inserted, registrationId:', registrationId);

          if(session.metadata.teamPayType === 'team'){
              for (const item of session.metadata.rosterUserId.split(', ')) {
                console.log(item)
                  await new sql.Request(transaction)
                      .input('registrationId', sql.Int, registrationId)
                      .input('userId', sql.Int, item)
                      .input('leagueId', sql.VarChar, session.metadata.leagueId)
                      .input('teamId', sql.VarChar, session.metadata.teamId)
                      .input('seasonId', sql.Int, session.metadata.seasonId)
                      .input('division', sql.VarChar, session.metadata.division)
                      .input('keeper', sql.Bit, session.metadata.keeperId == item ? 1 : 0)
                      .input('test', sql.Bit, !session.livemode)
                      .input('paid', sql.Bit, 1)
                      .input('shirtSize', sql.VarChar(10), JSON.parse(session.metadata.shirtSizes)[String(item)])
                      .query(`
                          INSERT INTO seasonRegistration_leagueTeam (registrationId, leagueId, teamId, userId, seasonId, test, division, keeper, paid, shirtSize)
                          VALUES (@registrationId, @leagueId, @teamId, @userId, @seasonId, @test, @division, @keeper, @paid, @shirtSize)
                      `);
                  if(session.metadata.waiverPaid){
                    await new sql.Request(transaction)
                          .input('waiverPayDate', sql.BigInt, Date.now())
                          .input('userId', sql.Int, item)
                          .query(`
                            update users
                            set waiverPayDate = @waiverPayDate
                            where ID = @userId
                            `)
                  }
              }
          }else{
            await new sql.Request(transaction)
                      .input('registrationId', sql.Int, registrationId)
                      .input('userId', sql.Int, req.user.id)
                      .input('leagueId', sql.VarChar, session.metadata.leagueId)
                      .input('teamId', sql.VarChar, session.metadata.teamId)
                      .input('seasonId', sql.Int, session.metadata.seasonId)
                      .input('division', sql.VarChar, session.metadata.division)
                      .input('keeper', sql.Bit, ['true', true, 1].includes(session.metadata.keeper) ? 1 : 0)
                      .input('test', sql.Bit, !session.livemode)
                      .input('paid', sql.Bit, 1)
                      .input('shirtSize', sql.VarChar(10), String(session.metadata.shirtSize))
                      .query(`
                          INSERT INTO seasonRegistration_leagueTeam (registrationId, leagueId, teamId, userId, seasonId, test, division, keeper, paid, shirtSize)
                          VALUES (@registrationId, @leagueId, @teamId, @userId, @seasonId, @test, @division, @keeper, @paid, @shirtSize)
                      `);
              if(session.metadata.waiverPaid){
                await new sql.Request(transaction)
                      .input('waiverPayDate', sql.BigInt, Date.now())
                      .input('userId', sql.Int, req.user.id)
                      .query(`
                        update users
                        set waiverPayDate = @waiverPayDate
                        where ID = @userId
                        `)
              }
          }
            

            await transaction.commit()
            isTransactionActive = false
      }
        // fetch(`${req.protocol}://${req.get('host')}/seasons/${session.metadata.seasonId}/registration`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        //   body: new URLSearchParams({ sessionId: req.query.sessionId }).toString(),
        // })
        //   .then(response => response.json())
        //   .then(data => {
        //     console.log('Payment processed successfully:', data);
        //   })
        //   .catch(error => {
        //     console.error('Error processing payment:', error);
        //   });




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
        functions.newRegistrationEmail(session.id)
        res.render('paymentSuccess.ejs');
        
    }catch(err){
      console.log(isTransactionActive)
      if (isTransactionActive) {
        await transaction.rollback();
      }
      functions.rollBackTeam()
        console.log(err)
        res.render('paymentSuccess.ejs');
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
            url: req.query.url || 'https://glosoccer.com'
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
router.post('/teamSeasonCheckoutSession', upload.single('teamLogo'), async (req, res) => {
  
  try {
    // let result = await pool.request()
    // .input('leagueId',sql.Int,req.body.leagueId)
    // .query(`
    //   select *
    //   from leagues as l
    //   where l.leagueId = @leagueId
    //   `)
    const consolidatedBody = Object.entries(req.body).reduce((acc, [key, value]) => {
      if (Array.isArray(value)) {
        value = value.join(", ");
      }
    
      // Handle shirt sizes
      if (key.startsWith("shirtSize_")) {
        const id = key.replace("shirtSize_", "");
        acc.shirtSizes = acc.shirtSizes || {};
        acc.shirtSizes[id] = value;
      }
      // Handle discounts
      else if (key.startsWith("discounted_")) {
        const id = key.replace("discounted_", "");
        acc.discounts = acc.discounts || [];
        acc.discounts.push(id);
      }
      else if (key.startsWith("payNow_")) {
        const id = key.replace("payNow_", "");
        acc.payingNow = acc.payingNow || [];
        acc.payingNow.push(id);
      }
      // Handle other fields normally
      else {
        acc[key] = value;
      }
    
      return acc;
    }, {});
    const transformedBody = Object.fromEntries(
      Object.entries(consolidatedBody).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : (typeof value === "object" && value !== null ? JSON.stringify(value) : value),
      ])
    );
    
    // const transformedBody = Object.fromEntries(
    //   Object.entries(consolidatedBody).map(([key, value]) => [
    //     key,
    //     Array.isArray(value) ? value.join(", ") : value,
    //   ])
    // );

    const product = await stripe.products.search({
        query: `name:'8 Game Season'`,
    })
    const prices = await stripe.prices.list({
      product: product.id,
      active: true, // Only get active prices
  });

  // console.log(req.body.teamPayType === 'team' ? 'Team' : (req.body.discounted === 'true' ? 'Student, Teacher, First Responder, Military' : 'Regular'))
  let nickname;
  let productName;
  const crewRoles = ['scorekeeper', 'Referee', 'Monitor']
  console.log(req.user)
  if (req.body.teamPayType === 'team') {
    nickname = 'Team';
    productName = 'Team'
  } else if (req.user.roles.some(role => crewRoles.includes(role.name))) {
    nickname = 'Crew';
    productName = 'Crew'
  } else if (req.user.roles.some(role => ['Friend', 'Family'].includes(role.name))) {
    nickname = 'Crew';
    productName = 'Friends & Family'
  } else if (req.body.discounted === 'true') {
    nickname = 'Student, Teacher, First Responder, Military';
    productName = 'Student, Teacher, First Responder, Military'
  } else {
    nickname = 'Regular';
    productName = 'Individual'
  }

const teamPrice = prices.data.find(price => price.nickname === nickname);
  // const teamPrice = prices.data.find(price => price.nickname === (req.body.teamPayType === 'team' ? 'Team' : (req.body.discounted === 'true' ? 'Student, Teacher, First Responder, Military' : 'Regular')))
  const lineItems = [{
    price_data: {
      currency: 'usd',
      product_data: {
        name: `Spring 2025 - ${productName}`,
      },
      unit_amount: teamPrice.unit_amount, // amount in cents
    },
    quantity: 1,
  }]
  let totalPrice = teamPrice.unit_amount
  let result = await pool.request()
    .input('leagueId',sql.Int,req.body.leagueId)
    .query(`
      select *
      from leagues as l
      where l.leagueId = @leagueId
      `)
      console.log(req.body.teamPayType)
      if(result.recordset[0].abbreviation == 'PCI' || result.recordset[0].abbreviation == 'PCO'){
        totalPrice = totalPrice + (req.body.teamPayType === 'team' ? 15000 : 1500)
        lineItems.push(
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Referee Fees - Premier - ${req.body.teamPayType === 'team' ? 'Team' : 'Individual'}`,
              },
              unit_amount: req.body.teamPayType === 'team' ? 15000 : 1500, // amount in cents
            },
            quantity: 1,
          }
        )
      }else if(result.recordset[0].abbreviation == 'MOI' || result.recordset[0].abbreviation == 'MOO'){
        totalPrice = totalPrice + (req.body.teamPayType === 'team' ? 30000 : 3000)
        lineItems.push(
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Referee Fees - Men's - ${req.body.teamPayType === 'team' ? 'Team' : 'Individual'}`,
              },
              unit_amount: req.body.teamPayType === 'team' ? 30000 : 3000, // amount in cents
            },
            quantity: 1,
          }
        )
      }
      let waiverPay = await functions.checkWaiverFeeDue(req.user.id)
      if(req.body.teamPayType === 'self'){
        // console.log('test')
        if(waiverPay){
          lineItems.push(
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Annual GLOS Waiver Fee',
                },
                unit_amount: req.body.discounted === 'true' ? 1000 : 2000, // amount in cents
              },
              quantity: 1,
            }
          )
          totalPrice = totalPrice + (req.body.discounted === 'true' ? 1000 : 2000)
        }
      }else{
        // const table = new sql.Table(); // Create a table-valued parameter
        // table.columns.add('ID', sql.BigInt); // Define column type
        // transformedBody.rosterUserId.split(', ').map(Number).forEach(id => table.rows.add(id)); // Add values

        const result = await pool.request()
        .input('userIds', sql.VarChar, transformedBody.rosterUserId)
        .input('waiverResetDate', sql.BigInt, functions.getWaiverResetDate())
        .query(`
                SELECT id from users
                where ID in (SELECT value FROM STRING_SPLIT(@userIds, ',')) 
                and waiverPayDate < @waiverResetDate
            `);
          transformedBody.waiverPaidIds = JSON.stringify(result.recordset.map(item => item.id))
          console.log(result.recordset)
          if(result.recordset.length !== 0){
            lineItems.push(
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: 'Annual GLOS Waiver Fees',
                  },
                  unit_amount: req.body.discounted === 'true' ? 1000 : 2000, // amount in cents
                },
                quantity: result.recordset.length,
              }
            )
            totalPrice = totalPrice + ((req.body.discounted === 'true' ? 1000 : 2000)*result.recordset.length)
          }
        // for(let uid of transformedBody.rosterUserId){

        // }
      }
      lineItems.push(
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Stripe Processing Fee',
            },
            unit_amount: (totalPrice*.03)+30, // amount in cents
          },
          quantity: 1,
        }
      )
    
    // console.log(req.body)
    // console.log(specificPrice)
        if(req.body.teamId === ''){
          console.log('test team checkout')
          
          
          // const data = {
          //   abbreviation: req.body.teamAbbreviation,
          //   fullName: req.body.teamFullName,
          //   shortName: req.body.teamShortName,
          //   leagueId: req.body.leagueId,
          //   seasonId: req.body.seasonId,
          //   teamId: req.body.teamId,
          //   color: req.body.teamShirtColor1,
          //   captainId: transformedBody.captainId || req.user.id,
          //   keeperId: transformedBody.keeperId || req.user.id
          // }
          transformedBody.captainId = transformedBody.captainId || req.user.id
          transformedBody.keeperId = transformedBody.keeperId || req.user.id
          transformedBody.teamId = await functions.addTeam(transformedBody)
          transformedBody.teamType = 'new'
          
        }else{
          transformedBody.teamType = 'existing'
        }
        if(req.file){
          functions.addTeamLogo(req.file,req.body.teamId)
        }   
      const metadata = {
        type: 'teamSeasonCheckout',
        lineItems: lineItems,
        priceId: teamPrice.id,
        success_url: `${req.headers.origin}/api/payments/success?sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.get('Referer') || 'https://glosoccer.com'}`,
        metadata: {type: 'teamSeasonCheckout'
          , ...transformedBody
          ,waiverPaid: waiverPay
        }
      }
      metadata.quantity = 1
      await functions.addUserToDatabase(req.body);
      const user = await functions.getUser(req.body)
      metadata.userId = user.ID
      // Full discount code 
      // ,[{
      //   coupon: 'SENIORCREW100', 
      // }]
      const session = await functions.createCheckoutSession({
          metadata,
        
        }
        
      );
      functions.updateUserInfo({
        userId: req.user.id,
        ...transformedBody,
        waiverDate: Date.now()
      })
      res.json({ url: session.url });
  } catch (error) {
    console.log(error)
      res.status(500).json({ error: error.message });
  }
});
router.post('/individualSeasonCheckoutSession', async (req, res) => {
  
  try {
    const transformedBody = Object.fromEntries(
      Object.entries(req.body).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(", ") : value,
      ])
    );
    const product = await stripe.products.search({
        query: `name:'8 Game Season'`,
    })
    const prices = await stripe.prices.list({
      product: product.id,
      active: true, // Only get active prices
  });
  let nickname;
  let productName;
  const crewRoles = ['scorekeeper', 'Referee', 'Monitor']
  console.log(req.user)
  if (req.user.roles.some(role => crewRoles.includes(role.name))) {
    nickname = 'Crew';
    productName = 'Crew'
  } else if (req.user.roles.some(role => ['Friend', 'Family'].includes(role.name))) {
    nickname = 'Crew';
    productName = 'Friends & Family'
  } else if (req.body.discounted === 'true') {
    nickname = 'Student, Teacher, First Responder, Military';
    productName = 'Student, Teacher, First Responder, Military'
  } else {
    nickname = 'Regular';
    productName = 'Individual'
  }

const price = prices.data.find(price => price.nickname === nickname);
    // const price = await stripe.prices.retrieve(product.data[0].default_price);
    console.log(price)
    // console.log(product.data[0].default_price)
    let leaguesTeams = [];
    let result 
    let lineItems = []
    let totalPrice = 0

    Object.keys(req.body).forEach(key => {
        if (key.includes('leagueId_')) {
            let remainingKey = key.replace('leagueId_', ''); // Remove 'leagueId_'
            
            // Find another key that contains the remaining part
            let teamKey = Object.keys(req.body).find(k => k.includes(`${remainingKey}_teamId`) && k !== key);
            let divisionKey = Object.keys(req.body).find(k => k.includes(`${remainingKey}_division`) && k !== key);
            if (teamKey) {
                leaguesTeams.push({
                    leagueId: remainingKey,
                    teamId: req.body[teamKey],
                    division: req.body[divisionKey]
                });
            }
        }
    });
    for(const league of leaguesTeams){
      result = await pool.request()
            .input('leagueId',sql.Int,league.leagueId)
            .query(`
              select *
              from leagues as l
              where l.leagueId = @leagueId
              `)
            console.log(result.recordset[0])
        lineItems.push(
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Spring 2025 - ${result.recordset[0].shortName} - ${productName}`,
              },
              unit_amount: price.unit_amount, // amount in cents
            },
            quantity: 1,
          }
        )
        totalPrice = totalPrice + price.unit_amount
        if(result.recordset[0].abbreviation == 'PCI' || result.recordset[0].abbreviation == 'PCO'){
          totalPrice = totalPrice + 1500
          lineItems.push(
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Referee Fees - Premier - Individual',
                },
                unit_amount: 1500, // amount in cents
              },
              quantity: 1,
            }
          )
        }else if(result.recordset[0].abbreviation == 'MOI' || result.recordset[0].abbreviation == 'MOO'){
          totalPrice = totalPrice + 3000
          lineItems.push(
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Referee Fees - Men's - Individual`,
                },
                unit_amount: 3000, // amount in cents
              },
              quantity: 1,
            }
          )
        }
    }
    let waiverPay = await functions.checkWaiverFeeDue(req.user.id)
    if(waiverPay){
      lineItems.push(
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Annual GLOS Waiver Fee',
            },
            unit_amount: req.body.discounted === 'true' ? 1000 : 2000, // amount in cents
          },
          quantity: 1,
        }
      )
      totalPrice = totalPrice + (req.body.discounted === 'true' ? 1000 : 2000)
    }
    
    lineItems.push(
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Stripe Processing Fee',
          },
          unit_amount: (totalPrice*.03)+30, // amount in cents
        },
        quantity: 1,
      }
    )
    const metadata = {
      type: 'individualSeasonCheckout',
      lineItems: lineItems
      ,
      priceId: product.data[0].default_price,
      success_url: `${req.headers.origin}/api/payments/success?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.get('Referer') || 'https://glosoccer.com'}`,
      // `${req.headers.origin}/api/payments/cancel?sessionId={CHECKOUT_SESSION_ID}&url=${req.get('Referer') || 'https://envoroot.com'}`,
      metadata: {type: 'individualSeasonCheckout'
        , ...transformedBody
        ,leaguesTeams: JSON.stringify(leaguesTeams)
        ,waiverPaid: waiverPay
      }
    }
    metadata.quantity = leaguesTeams.length
    metadata.leaguesTeams = JSON.stringify(leaguesTeams)
    console.log(req.get('Referer'))
      
      await functions.addUserToDatabase(req.body);
      const user = await functions.getUser(req.body)
      metadata.userId = user.ID
      const isSeniorCrew = req.user.roles?.some(role => role.name === 'Senior Staff');

      functions.updateUserInfo({
      userId: req.user.id,
      ...transformedBody,
      waiverDate: Date.now()
    })
    if(totalPrice > 0){
      const session = isSeniorCrew
        ? await functions.createCheckoutSession({ metadata }, [{ coupon: 'SENIORCREW100' }])
        : await functions.createCheckoutSession({ metadata });
    
      res.json({ url: session.url });
    }else{
      res.json({message: `You are all paid up for registered teams and annual waiver fee. 
        If you meant to register for another team please select the appropriate league.
        Thank you.`})
    }

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
