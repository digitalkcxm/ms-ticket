import dotenv from "dotenv";
dotenv.config();
export default {
  development: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST,
      database: process.env.DB,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: "./src/config/database/migrations",
    },
    seeds: {
      directory: "./src/config/database/seeds",
    },
    pool: {
      afterCreate: function (connection, callback) {
        connection.query("SET timezone = -3;", function (err) {
          callback(err, connection);
        });
      },
    },
  },

  production: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST,
      database: process.env.DB,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
    },
    migrations: {
      directory: "./src/config/database/migrations",
    },
    seeds: {
      directory: "./src/config/database/seeds",
    },
    pool: {
      afterCreate: function (connection, callback) {
        connection.query("SET timezone = -3;", function (err) {
          callback(err, connection);
        });
      },
    },
  },

  testing: {
    client: "postgresql",
    connection: {
      host: process.env.DB_HOST_TEST,
      database: process.env.DB_TEST,
      user: process.env.DB_USERNAME_TEST,
      password: process.env.DB_PASSWORD_TEST,
    },
    migrations: {
      directory: "./src/config/database/migrations",
    },
    seeds: {
      directory: "./src/config/database/seeds",
    },
    pool: {
      afterCreate: function (connection, callback) {
        connection.query("SET timezone = -3;", function (err) {
          callback(err, connection);
        });
      },
    },
  },
};
