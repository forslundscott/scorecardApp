const crypto = require('crypto');
if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}

const mailchimp = {
    marketing: require('@mailchimp/mailchimp_marketing'),
    transactional: require('@mailchimp/mailchimp_transactional')(process.env.MANDRILL_KEY)
    }
mailchimp.marketing.setConfig({
    apiKey: process.env.MAILCHIMP_KEY,
    server: process.env.MAILCHIMP_SERVER, // e.g., us1
})
async function getListByName(xname){
    // const run = async () => {
        // const response = await mailchimp.marketing.lists
        // const response = await mailchimp.marketing.lists.getListMembersInfo("0e63a5b642")
        const response = await mailchimp.marketing.lists.getAllLists();
        
        // const response = await mailchimp.marketing.lists.getList({
        //     name: { match: 'Greater Lansing Open Soccer'}
        // })
        // console.log(response.lists[0].name)
        return response.lists.find(obj => obj.name === xname);
    //   };
    //   run()
    
}
async function getAllContacts() {
    let allContacts = [];
  let offset = 0;
  const count = 100; // Number of results per request, adjust as needed

  try {
    while (true) {
      const response = await axios.get(`${BASE_URL}/lists/${LIST_ID}/members`, {
        headers: {
          'Authorization': `apikey ${API_KEY}`
        },
        params: {
          offset: offset,
          count: count
        }
      });

      const contacts = response.data.members;
      allContacts = allContacts.concat(contacts);

      // Check if we've fetched all contacts
      if (contacts.length < count) {
        break;
      }

      offset += count;
    }

    // Handle response
    console.log('Total contacts:', allContacts.length);
    console.log('Contacts:', allContacts);
  } catch (error) {
    console.error('Error fetching contacts:', error.response.data);
  }
}

async function sendMessage(recipientEmail, subject, message){
    const response = await mailchimp.transactional.messages.send({
            message: {
                subject: subject,
                text: message,
                to: [{
                    email: recipientEmail,
                }],
            },
        });
}
async function getListMembers(xid){
    // const run = async () => {
        // const response = await mailchimp.marketing.lists
        // const response = await mailchimp.marketing.lists.getListMembersInfo("0e63a5b642")
        const response = await mailchimp.marketing.lists.getListMembersInfo(xid);
        
        // const response = await mailchimp.marketing.lists.getList({
        //     name: { match: 'Greater Lansing Open Soccer'}
        // })
        // console.log(response.lists[0].name)
        return response;
    //   };
    //   run()
    
}
async function getMemberTags(listId,subscriberHash){
    // const run = async () => {
        // const response = await mailchimp.marketing.lists
        // const response = await mailchimp.marketing.lists.getListMembersInfo("0e63a5b642")
        const response = await mailchimp.marketing.lists.getListMemberTags(
            listId,
            subscriberHash
          )
        
        // const response = await mailchimp.marketing.lists.getList({
        //     name: { match: 'Greater Lansing Open Soccer'}
        // })
        // console.log(response.lists[0].name)
        return response;
    //   };
    //   run()
    
}
async function getLists(){
        const response = await mailchimp.marketing.lists.getAllLists();
        return response
}
async function getRoot(){
    const response = await mailchimp.marketing.root.getRoot();
    return response
}
async function getTemplates(){
    const response = await mailchimp.marketing.templates.list();
    return response
}
async function getCampaigns(){
    const response = await mailchimp.marketing.campaigns.list();
    return response
}
async function fetchAllMembers(listId){
  const allMembers = [];
  let offset = 0;
  const count = 1000; // Max members per request

  try {
    while (true) {
      const response = await mailchimp.marketing.lists.getListMembersInfo(listId, {
        count,
        offset,
      });

      // Add fetched members to the allMembers array
      allMembers.push(...response.members);

      // If less than 'count' members are returned, we've reached the end
      if (response.members.length < count) {
        break;
      }

      // Increment offset for the next batch
      offset += count;
    }

    return allMembers;
  } catch (error) {
    console.error("Error fetching members:", error);
    throw error;
  }
};
async function getMemberByEmail(listId, email){
  try {
    // Hash the email to the MD5 format required by Mailchimp
    const emailHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex");

    // Fetch the member details using the hashed email
    const member = await mailchimp.marketing.lists.getListMember(listId, emailHash);

    return member; // Return the member details
  } catch (error) {
    console.error("Error fetching member:", error);
    throw error; // Propagate the error to the caller
  }
};
async function listInterestCategories(listId){
  try {
    // Fetch the interest categories for the specified list ID
    const response = await mailchimp.marketing.lists.listInterestCategories(listId, {
      count: 100, // Maximum number of categories to fetch
    });

    return response.categories; // Return the categories array
  } catch (error) {
    console.error("Error fetching interest categories:", error);
    throw error; // Propagate the error to the caller
  }
};
module.exports = {getListByName,sendMessage,getListMembers,getMemberTags,getLists,getRoot,getTemplates,getCampaigns,fetchAllMembers,getMemberByEmail,marketing: mailchimp.marketing,listInterestCategories}