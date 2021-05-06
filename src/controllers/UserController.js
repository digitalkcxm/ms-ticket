const UserModel = require("../models/UserModel")

const userModel = new UserModel

class UserController {
    async checkUserCreated(user, company_id, name = '') {
        try {
            let result = await userModel.getUserByID(user, company_id)
            if (!result || result.length <= 0) {
                result = await userModel.create({
                    "id_users_core": user,
                    "id_company": company_id,
                    "name": name
                })
            }

            return result[0]
        } catch (err) {
            console.log("Error when verify user if created")
        }
    }
}

module.exports = UserController