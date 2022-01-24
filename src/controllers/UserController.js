const UserModel = require("../models/UserModel");

const userModel = new UserModel();

class UserController {
  async checkUserCreated(user, company_id, name = "", phone = "", email = "",id_type = 1) {
    try {
      let result = await userModel.getUserByID(user, company_id);
      if (!result || result.length <= 0) {
        result = await userModel.create({
          id_users: user,
          id_company: company_id,
          name: name,
          phone,
          email,
          id_type,
        });
      } else if (result && !result[0].name) {
        await userModel.update(result[0].id, { name });
      }

      return result[0];
    } catch (err) {
      console.log("Error when verify user if created");
    }
  }
}

module.exports = UserController;
