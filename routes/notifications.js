const express = require('express');
const router = express.Router();
const pool = require(`../db`)
const functions = require('../helpers/functions')
const mailchimp = require('../helpers/mailChimp')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

// const mailchimp = {
//     marketing: require('@mailchimp/mailchimp_marketing'),
//     transactional: require('@mailchimp/mailchimp_transactional')(process.env.MANDRILL_KEY)
//     }
// const bodyParser = require('body-parser')
// mailchimp.marketing.setConfig({
//     apiKey: process.env.MAILCHIMP_KEY,
//     server: process.env.MAILCHIMP_SERVER, // e.g., us1
// })

  
  // Express route to fetch all list members
  router.get("/tagSearch", async (req, res) => {
    
  
    try {
        const listId = (await mailchimp.getListByName('Greater Lansing Open Soccer')).id
      const tags = await mailchimp.marketing.lists.tagSearch(listId
    //     , {
    //     name: 'pickup'
    //   }
    );
      res.status(200).json({ tags });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch interests",
        details: error.message,
      });
    }
  });
  router.get("/listInterests", async (req, res) => {
    
  
    try {
        const listId = (await mailchimp.getListByName('Greater Lansing Open Soccer')).id
      const interests = await mailchimp.marketing.lists.getListInterestCategories(listId);
      res.status(200).json({ interests });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch interests",
        details: error.message,
      });
    }
  });
  router.get("/memberbyemail", async (req, res) => {
    
  
    try {
        const listId = (await mailchimp.getListByName('Greater Lansing Open Soccer')).id
      const member = await mailchimp.getMemberByEmail(listId,'forslund.scott@gmail.com');
      res.status(200).json({ member });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch members",
        details: error.message,
      });
    }
  });
  router.get("/exportMembers", async (req, res) => {
    
  
    try {
      const listId = (await mailchimp.getListByName('Greater Lansing Open Soccer')).id
      const members = await mailchimp.fetchAllMembers(listId);
      const csvData = await functions.exportToCSV(members);
      // console.log(csvData)
      // Set response headers for CSV download
      res.setHeader('Content-disposition', `attachment; filename=members.csv`);
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csvData);
      // res.status(200).json({ total: members.length, members });
    } catch (error) {
      res.status(500).json({
        error: "Failed to fetch members",
        details: error.message,
      });
    }
  });
  
router.get('/send-email', async (req, res) => {
    // const { recipientEmail, subject, message } = req.body;

    try {
        // const response = await mailchimp.transactional.messages.send({
        //     message: {
        //         subject: 'test',
        //         text: 'testing',
        //         to: [{
        //             email: 'forslund.scott@gmail.com',
        //         }],
        //     },
        // });
        // const run = async () => {
        //     // const response = await mailchimp.marketing.lists
        //     // const response = await mailchimp.marketing.lists.getListMembersInfo("0e63a5b642")
        //     const response = await mailchimp.marketing.lists.getAllLists();
            
        //     // const response = await mailchimp.marketing.lists.getList({
        //     //     name: { match: 'Greater Lansing Open Soccer'}
        //     // })
        //     console.log(response.lists[0].name)
        //     console.log(response.lists.find(obj => obj.name === 'Greater Lansing Open Soccer'));
        //   };
        //   run()

        // console.log('Email sent:', response);
        // console.log(await mailchimp.getListByName('Greater Lansing Open Soccer'))
        console.log(await mailchimp.getCampaigns()[0])
        // await mailchimp.sendMessage('forslund.scott@gmail.com','Testing Madrill Email', 'Testing Transactional email sending through MailChimp module Madrill.')
        // console.log((await mailchimp.getListMembers((await mailchimp.getListByName('Greater Lansing Open Soccer')).id)).members.find(item=>item.email_address == 'forslund.scott@gmail.com'))
        // console.log((await mailchimp.getListMembers((await mailchimp.getListByName('Greater Lansing Open Soccer')).id)).members)
        // console.log((await mailchimp.getListMembers((await mailchimp.getListByName('Greater Lansing Open Soccer')).id)).members.length)
        // const listId = (await mailchimp.getListByName('Greater Lansing Open Soccer')).id
        // console.log(await mailchimp.getMemberTags(listId,(await mailchimp.getListMembers(listId)).members[1].id))
        // console.log(await mailchimp.getLists());
        res.send('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Failed to send email');
    }
})
router.get('/', async (req,res, next)=>{
    // try{
    //  
    // }catch(err){
    //     next(err)
    // }
});

// Define a POST route for `/users`
// router.post('/', (req, res) => {
//   res.send('Create a new user');
// });

// Export the router so it can be used in other files
module.exports = router;
