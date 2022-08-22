import UserModel from "../models/UserModel.js";
export default class UserController {
  constructor(database = {}, logger = {}) {
    this.logger = logger;
    this.userModel = new UserModel(database, logger);
  }
  async checkUserCreated(
    user,
    company_id,
    name = "",
    phone = "",
    email = "",
    id_type = 1
  ) {
    let obj = {};
    name ? (obj.name = name) : "";
    phone ? (obj.phone = phone) : "";
    email ? (obj.email = email) : "";
    id_type ? (obj.id_type = id_type) : "";

    try {
      let result = await this.userModel.getUserByID(user, company_id, id_type);
      console.log('result ==> ',result)
      if (!result || result.length <= 0) {
        obj = { ...obj, id_users: user, id_company: company_id };

        result = await this.userModel.create(obj);
      } else {
        console.log("obj => ",obj)
        await this.userModel.update(result[0].id, obj);
      }

      return result[0];
    } catch (err) {
      this.logger.error(err, "Error when verify user if created");
    }
  }
}
