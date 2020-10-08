const MongoClient = require('mongodb').MongoClient


module.exports = async (app, callback) => {

    let connectionMongo = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}`

    if (process.env.MONGO_STRINGCONNECTION_PARAMS)`${connectionMongo}?${process.env.MONGO_STRINGCONNECTION_PARAMS}`

    MongoClient.connect(connectionMongo, { useUnifiedTopology: true, promiseLibrary: Promise }, (err, conn) => {
        if (err) console.error(`#00000 - Falha ao conectar ao banco de dados. ${err.stack}`)

        const db = conn.db(process.env.MONGO_DATABASE)
        console.log("we are connect to mongodb !!")

        app.locals.db = db
        callback()
    })
}
