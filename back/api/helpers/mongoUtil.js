var MongoClient = require( 'mongodb' ).MongoClient;
const uri = "mongodb://localhost:27017/";
const client = new MongoClient(uri, { useNewUrlParser: true });

var _db;

module.exports = {

  connectToServer: function( callback ) {
    client.connect(function( err, db ) {
      _db = db;
      return callback( err );
    } );
  },

  getDb: function() {
    return _db;
  }
};