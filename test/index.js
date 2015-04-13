/**
 * Created by dob on 20.11.13.
 */
var should = require('should'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  mongoose = require('mongoose'),
  mlcldb = require('../');

describe('mlcl_database', function() {
  var mlcl;
  var molecuel;
  var catschema;
  var catmodel;
  var mlcl_database;
  var testdoc;

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

    catschema = new mongoose.Schema({ name: String });

    done();
  });

  describe('database', function() {
    it('should initialize', function(done) {
      molecuel.on('mlcl::database::connection:success', function(database) {
        mlcl_database = database;
        database.should.be.a.object;
        done();
      });
      molecuel.emit('mlcl::core::init:post', molecuel);
    });

    it('should register a model', function(done) {
      catmodel = mlcl_database.registerModel('cat', catschema);
      done();
    });

    it('should save a element', function(done) {
      testdoc = new catmodel({ name: 'Zildjian' });
      testdoc.save(function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should read from mongoose', function(done) {
      catmodel.find({_id: {'$in': [testdoc._id]}}, function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should read from mongoose and hit the cache', function(done) {
      catmodel.find({_id: {'$in': [testdoc._id]}}, function(err) {
        should.not.exist(err);
        done();
      });
    });

    it('should delete the document', function(done) {
      testdoc.remove(function(err) {
        should.not.exist(err);
        done();
      });
    });

  });
});
