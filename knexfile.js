require('dotenv').load

module.exports = {

  development: {
    client: 'postgresql',
    connection: {
      host:     process.env.DB_HOST,
      database: process.env.DB,
      user:     process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD
    },
    migrations: {
      directory: __dirname + '/src/config/database/migrations'
    },
    seeds: {
      directory: __dirname + '/src/config/database/seeds'
    },
    debug: false,
    pool: {
      afterCreate: function(connection, callback) {
        connection.query('SET timezone = -3;', function(err) {
          callback(err, connection);
        });
      }
   }
  },

  production: {
    client: 'postgresql',
    connection: {
      host:     process.env.DB_HOST,
      database: process.env.DB,
      user:     process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD
    },
    migrations: {
      directory: __dirname + '/src/config/database/migrations'
    },
    seeds: {
      directory: __dirname + '/src/config/database/seeds'
    },
    pool: {
      afterCreate: function(connection, callback) {
        connection.query('SET timezone = -3;', function(err) {
          callback(err, connection);
        });
      }
   }
  }

};
