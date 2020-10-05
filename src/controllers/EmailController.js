const EmailModel = require("../models/EmailModel")
const TicketModel = require("../models/TicketModel")

const moment = require("moment")
const emailModel = new EmailModel()
const ticketModel = new TicketModel()

class EmailController {
    async checkEmailCreated(email, company_id) {
        try {
            let result = await emailModel.getEmailByEmail(email, company_id)
            if (!result || result.length <= 0)
                result = await emailModel.createEmail({
                    "id_company": company_id,
                    "email": email,
                    "created_at": moment().format(),
                    "updated_at": moment().format()
                })

            return result[0]
        } catch (err) {
            console.log("Error when check if email created => ", err)
            return err
        }
    }

    async incomingEmail(req, res) {
        try {
            if (!req.body.chat.id)
                return res.status(400).send({ error: "There was an error" })

            let id_ticket = await emailModel.getByChatId(req.body.chat.id)
            if (!id_ticket || id_ticket.length <= 0)
                return res.status(400).send({ error: "There was an error" })

            let obj = {
                "text": req.body.body,
                "id_ticket": id_ticket[0].id_ticket,
                "id_chat": id_ticket[0].id,
                "created_at": moment().format(),
                "updated_at": moment().format()
            }

            let result = await ticketModel.create(obj, "activities_ticket")
            if (!result && !result[0])
                return res.status(400).send({ error: "There was an error" })

            return res.status(200).send("Ok")
        } catch (err) {
            console.log("Incoming Error =>", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }
}

module.exports = EmailController