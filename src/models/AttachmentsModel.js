const tableName = "attachments_ticket";

export default class AttachmentsModel {
  constructor(database = {}, logger = {}) {
    this.database = database;
    this.logger = logger;
  }
  async getCountAttachments(id_ticket) {
    try {
      const resultCount = await this.database(tableName)
        .count()
        .where("id_ticket", id_ticket);
      return resultCount[0].count;
    } catch (err) {
      this.logger.error(
        err,
        "Error when get count total attachments of ticket mencioned."
      );
      return err;
    }
  }

  async getAttachments(id_ticket) {
    try {
      return await this.database("attachments_ticket")
        .select({
          id: "attachments_ticket.id",
          url: "attachments_ticket.url",
          type: "type_attachments.name",
          id_user: "users.id_users",
          user: "users.name",
          name: "attachments_ticket.name",
          created_at: "attachments_ticket.created_at",
          updated_at: "attachments_ticket.updated_at",
          text: "attachments_ticket.text"
        })
        .leftJoin(
          "type_attachments",
          "type_attachments.id",
          "attachments_ticket.type"
        )
        .leftJoin("users", "users.id", "attachments_ticket.id_user")
        .where("attachments_ticket.id_ticket", id_ticket);
    } catch (err) {
      this.logger.error(err, "Error get Attachments.");
      return err;
    }
  }

  async create(obj) {
    try {
      return await this.database(tableName).returning(["id"]).insert(obj);
    } catch (err) {
      this.logger.error(err, "Error when create activities.");
      return err;
    }
  }
}
