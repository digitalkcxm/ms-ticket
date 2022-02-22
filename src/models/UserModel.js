import database from "../config/database/database.js";

const tableName = "users";

export default class UserModel {
  constructor(database = {}, logger = {}) {
    this.database = database;
    this.logger = logger;
  }
  async getUserByID(id, company_id, id_type) {
    try {
      return await this.database(tableName)
        .select(["users.id", "users.name", "type_user.name as source"])
        .leftJoin("type_user", "type_user.id", `users.id_type`)
        .where("id_users", id)
        .andWhere("id_company", company_id)
        .andWhere("users.id_type", id_type);
    } catch (err) {
      this.logger.error(err,"Error when catch user info by id. ");
      return err;
    }
  }

  async create(obj) {
    try {
      return await this.database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err,"Error when create user.");
      return err;
    }
  }

  async getById(id, id_company) {
    try {
      return await this.database("users")
        .where("id", id)
        .andWhere("id_company", id_company);
    } catch (err) {
      this.logger.error(err,"Error when get user by id.");
      return err;
    }
  }

  async update(id, obj) {
    try {
      return await database("users").update(obj).where("id", id);
    } catch (err) {
      this.logger.error(err,"Erro update user.");
      return err;
    }
  }
}
