import pkg from "mongodb";
const { ObjectID } = pkg;
const collection = "form";
export default class FormDocuments {
  constructor(db) {
    this._db = db;
  }

  async createRegister(data) {
    try {
      const result = await this._db.collection(collection).insertOne(data);
      return result.insertedId;
    } catch (err) {
      console.log("Error when create register form documents => ", err);
      return err;
    }
  }

  async findRegister(id) {
    try {
      console.log("id ===>",id)
      id = JSON.parse(id);

      return await global.mongodb.collection(collection).findOne({ _id: new ObjectID(id) });
    } catch (err) {
      console.log("Find Form register=>", err);
      return err;
    }
  }

  async searchRegister(search) {
    try {
      return await this._db
        .collection(collection)
        .find({ nome_tutor: { $regex: search, $options: "i" } })
        .toArray();
    } catch (err) {
      console.log("Search register in form collection ===> ", err);
      return err;
    }
  }

  async updateRegister(id, obj) {
    try {
      id = JSON.parse(id);
      return await this._db
        .collection(collection)
        .updateOne({ _id: new ObjectID(id) }, { $set: obj });
    } catch (err) {
      console.log("Error when update register =>", err);
      return err;
    }
  }
}
