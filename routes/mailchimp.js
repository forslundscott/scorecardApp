const express = require("express");
const router = express.Router();
const mailchimp = require("../mailchimp");

router.get("/", async (req, res) => {

    try {

        const response = await mailchimp.lists.getAllLists();

        res.render("mailchimpForm.ejs", {
            lists: response.lists
        });

    } catch (err) {
        console.error(err);
        res.send("Error loading Mailchimp lists");
    }

});

router.post("/send", async (req, res) => {

    try {

        const {
            listId,
            sendType,
            subject,
            fromName,
            replyTo,
            html
        } = req.body;

        let recipients = {
            list_id: listId
        };

        // TAG FILTERING
        if (
            sendType === "tags" &&
            req.body.tags
        ) {

            const selectedTags =
                Array.isArray(req.body.tags)
                    ? req.body.tags
                    : [req.body.tags];

            recipients.segment_opts = {

                match: "any",

                conditions:
                    selectedTags.map(tag => ({

                        condition_type: "TextMerge",

                        field: "tags",

                        op: "contains",

                        value: tag

                    }))

            };

        }

        // CREATE CAMPAIGN
        const campaign =
            await mailchimp.campaigns.create({

                type: "regular",

                recipients,

                settings: {

                    subject_line: subject,

                    from_name: fromName,

                    reply_to: replyTo

                }

            });

        // CONTENT
        await mailchimp.campaigns.setContent(
            campaign.id,
            {
                html
            }
        );

        // SEND
        await mailchimp.campaigns.send(
            campaign.id
        );

        res.send("Campaign sent!");

    } catch (err) {

        console.error(
            err.response?.body || err
        );

        res.send("Error sending campaign");

    }

});
router.get(
    "/list/:listId/tags",
    async (req, res) => {

        try {

            const response =
                await mailchimp.lists.tagSearch(
                    req.params.listId,
                    {}
                );

            res.json(response.tags);

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: "Error loading tags"
            });

        }

    }
);
module.exports = router;