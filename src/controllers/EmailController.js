const EmailModel = require("../models/EmailModel")

const emailModel = new EmailModel()

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
}

module.exports = EmailController