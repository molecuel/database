/**
 * Created by dob on 19.11.13.
 */
var molecuel;


var mlcl_database = function() {
  var self = this;
  this.database = require('mongoose');
  require('mongoose-query-paginate');

  this.database.connection.on('connected', function () {
    molecuel.emit('mlcl::database::connection:success', self);
  });

  this.database.connection.on('error', function () {
    console.log('Mongoose connection error');
  });

  molecuel.once('mlcl::core::init:post', function(molecuel) {
    self.config = molecuel.config.database;
    // call connect in scope of mlcl_database
    self.connect.call(self, self.config.options, function(err) {
      if(err) {
        console.log(err);
      }
    });
  });
};

/////////////////////
// singleton stuff
////////////////////
var instance = null;

var getInstance = function(){
  return instance || (instance = new mlcl_database());
};

/**
 * init module
 * @param app
 */
mlcl_database.prototype.initApplication = function() {

};

/**
 * Database connection
 * @param type
 * @param uri
 * @param options
 * @param callback
 */
mlcl_database.prototype.connect = function(options, callback) {
  molecuel.emit('mlcl::database::connect:pre', this);
  if(this.config && this.config.uri) {

    if(!options) {
      options = {};
    }
    if(!options.server) {
      options.server = {};
    }
    if(!options.server.socketOptions) {
      options.server.socketOptions = {};
    }
    if(!options.replset) {
      options.replset = {};
    }
    if(!options.replset.socketOptions) {
      options.replset.socketOptions = {};
    }
    options.server.socketOptions = options.replset.socketOptions = { keepAlive: 1 };
    this.options = options;

    this.database.connect(this.config.uri, function(err) {
      callback(err);
    });
    molecuel.emit('mlcl::database::connect:post', this);
  } else {
    throw new Error('No database specified');
  }
};

mlcl_database.prototype.close = function() {
  if(this.database) {
    this.database.close();
  }
};

/**
 * Register the model
 * @param modelname
 * @param model
 * @param indexable
 */
mlcl_database.prototype.registerModel = function(modelname, schema, options) {
  molecuel.emit('mlcl::database::registerModel:pre', this, modelname, schema, options);
  // register the schema - after this a redifinition is not possible anymore!
  var model = this.database.model(modelname, schema);
  molecuel.emit('mlcl::database::registerModel:post', this, modelname, model, options);
  // return the model
  return model;
};


function init(m) {
  molecuel = m;
  return getInstance();
}

module.exports = init;