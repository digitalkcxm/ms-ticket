const ObjectID = require("mongodb").ObjectID
let collection = "form"
class FormDocuments {
    constructor(db) {
        this._db = db
    }

    async createRegister(data) {
        try {
            const result = await this._db.collection(collection).insertOne(data)
            return result.insertedId
        } catch (err) {
            console.log("Error when create register form documents => ", err)
            return err
        }
    }

    async findRegister(id) {
        try {
            id = JSON.parse(id)
            return await this._db.collection(collection).findOne({ _id: ObjectID(id) })

        } catch (err) {
            console.log("Find Form register=>", err)
            return err
        }
    }

}

module.exports = FormDocuments