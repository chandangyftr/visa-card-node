const { promisify } = require('util');
const mysql = require('mysql');

class DB {
  constructor(dbConfigs) {
    this.dbConfigs = dbConfigs;
  }

  async query(queryStr, replacements = []) {
    try {
      var connection = mysql.createConnection(this.dbConfigs);
      return await promisify(connection.query).call(connection, queryStr, replacements);

    } catch (err) {
      console.log('DB_QUERY_ERR', err);
      throw err;
    } finally {
      connection.end();
    }
  }
}

module.exports = DB;
