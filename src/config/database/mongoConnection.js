import MongoClient from "mongodb";
MongoClient.MongoClient

export default async (app, callback) => {
    //  let connectionMongo = `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/`
     let connectionMongo = "mongodb://localhost:27017/msticket";

  if (process.env.MONGO_STRINGCONNECTION_PARAMS)
    connectionMongo = `${connectionMongo}${process.env.MONGO_DATABASE}?${process.env.MONGO_STRINGCONNECTION_PARAMS}`;
  console.log(connectionMongo);
  MongoClient.connect(
    connectionMongo,
    { useUnifiedTopology: true, promiseLibrary: Promise },
    (err, conn) => {
      if (err)
        console.error(
          `#00000 - Falha ao conectar ao banco de dados. ${err.stack}`
        );

      const db = conn.db();
      console.log("we are connect to mongodb !!");

      app.locals.db = db;
      global.mongodb = db;
       
      callback();
    }
  );
};
