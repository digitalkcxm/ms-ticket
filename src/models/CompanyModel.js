const tableName = "company";

export default class CompanyModel {
  constructor(database = {}, logger = {}) {
    this.database = database;
    this.logger = logger;
  }
  async create(obj) {
    try {
      return await this.database(tableName).returning("id").insert(obj);
    } catch (err) {
      this.logger.error(err, "Erro when create company.");
      return err;
    }
  }

  async getById(id) {
    try {
      return await this.database(tableName).where("id", id);
    } catch (err) {
      this.logger.error(err, `Error when get company with ID ${id}.`);
      return false;
    }
  }

  async getByIdActive(id) {
    try {
      return await this.database(tableName)
        .where("id", id)
        .andWhere("active", true);
    } catch (err) {
      this.logger.error(err, `Error when get active company with ID ${id}.`);
      return false;
    }
  }

  async update(obj, id) {
    try {
      return await this.database(tableName)
        .returning("*")
        .update(obj)
        .where("id", id);
    } catch (err) {
      this.logger.error(err, `Error when update company with ID ${id}.`);
      return err;
    }
  }
}
