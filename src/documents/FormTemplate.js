import pkg from 'mongodb'
const { ObjectID } = pkg;
const collection = "form_template";
export default class FormTemplate {
  constructor(logger) {
    this.logger = logger;
  }
  async createRegister(column) {
    try {
      const result = await global.mongodb.collection(collection).insertOne({
        column,
      });
      return result.insertedId;
    } catch (err) {
      this.logger.error(err, "Error when save document.");
      return err;
    }
  }

  async findRegister(id) {
    try {
      id = JSON.parse(id);
      

      return await global.mongodb.collection(collection).findOne({ _id: new ObjectID(id) });
    } catch (err) {
      this.logger.error(err, "Error when find register.");
      return err;
    }
  }

  async updateRegister(id, obj) {
    try {
      return await global.mongodb
        .collection(collection)
        .updateOne({ _id: new ObjectID(id) }, { $set: obj });
    } catch (err) {
      this.logger.error("Error when update register.");
      return err;
    }
  }
}
