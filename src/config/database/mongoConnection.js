import MongoClient from "mongodb";
MongoClient.MongoClient

export default async (app, callback) => {
    const connectionConfig = {
        username:        (process.env.NODE_ENV === 'testing') ? process.env.MONGO_USERNAME_TEST : process.env.MONGO_USERNAME,
        password:        (process.env.NODE_ENV === 'testing') ? process.env.MONGO_PASSWORD_TEST : process.env.MONGO_PASSWORD,
        host:            (process.env.NODE_ENV === 'testing') ? process.env.MONGO_HOST_TEST     : process.env.MONGO_HOST,
        port:            (process.env.NODE_ENV === 'testing') ? process.env.MONGO_PORT_TEST     : process.env.MONGO_PORT,
        database:        (process.env.NODE_ENV === 'testing') ? process.env.MONGO_DATABASE_TEST : process.env.MONGO_DATABASE,
        aditionalParams: (process.env.NODE_ENV === 'testing') ? process.env.MONGO_STRINGCONNECTION_PARAMS_TEST : process.env.MONGO_STRINGCONNECTION_PARAMS
    }

    let connectionMongo = `mongodb://${connectionConfig.username}:${connectionConfig.password}@${connectionConfig.host}:${connectionConfig.port}/`
    //let connectionMongo = "mongodb://localhost:27017/msticket";

  if (connectionConfig.aditionalParams)
    connectionMongo = `${connectionMongo}${connectionConfig.database}?${connectionConfig.aditionalParams}`;
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
