/**
 * Created by dob on 20.11.13.
 */
var should = require('should'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  mlcldb = require('../');

describe('mlcl_database', function() {
  var mlcl;
  var molecuel;

  before(function(done) {
    mlcl = function() {
      return this;
    };
    util.inherits(mlcl, EventEmitter);
    molecuel = new mlcl();

    molecuel.config = { };
    molecuel.config.database = {
      type: 'mongodb',
      uri: 'mongodb://localhost/mlcl_db_unit'
    };
    mlcldb(molecuel);
    done();
  });

  describe('database', function() {
    it('should initialize', function(done) {
      molecuel.on('mlcl::database::connection:success', function(database) {
        database.should.be.a.object;
        done();
      });
      molecuel.emit('mlcl::core::init:post', molecuel);
    });
  });
});
