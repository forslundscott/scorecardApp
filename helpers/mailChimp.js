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
module.exports = {getListByName,sendMessage,getListMembers,getMemberTags,getLists,getRoot,getTemplates,getCampaigns}