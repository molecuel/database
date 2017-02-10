'use strict';
import 'reflect-metadata';
import should = require('should');
import assert = require('assert');
import {di, injectable} from '@molecuel/di';
import {MlclCore} from '@molecuel/core';
import {MlclMongoDb} from '@molecuel/mongodb';
import {MlclDatabase, PERSISTENCE_LAYER, POPULATION_LAYER} from '../dist';
// import {Subject, Observable} from '@reactivex/rxjs';
should();

let config: any = {
  molecuel: {
    database: {
      name: 'mongodb_pers',
      type: 'MlclMongoDb',
      uri: 'mongodb://localhost/mongodb_persistence_test',
      layer: PERSISTENCE_LAYER
    }
  },
  databases: [{
    name: 'mongodb_popul',
    type: 'MlclMongoDb',
    uri: 'mongodb://localhost/mongodb_population_test',
    layer: POPULATION_LAYER
  }, {
    name: 'failing_db',
    type: 'MlclMongoDb',
    url: 'not_an_actual_url',
    layer: POPULATION_LAYER
  }]
};

describe('MlclDatabase', function() {
  before(() => {
    di.bootstrap(MlclCore, MlclMongoDb);
  });
  let dbHandler: MlclDatabase;
  describe('startup', () => {
    it('should be possible to load the database config', () => {
      try {
        dbHandler = di.getInstance('MlclDatabase');
        assert(dbHandler);
        dbHandler.should.be.instanceOf(MlclDatabase);
        dbHandler.addDatabasesFrom(config);
        (<any>dbHandler)._databases.should.be.an.Array();
        (<any>dbHandler)._databases.length.should.be.above(0);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to initialize all configured Database interfaces', async () => {
      try {
        await dbHandler.init();
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to access the database connections', () => {
      try {
        let connections = dbHandler.connections;
        should.exist(connections);
        (dbHandler.connections).should.be.an.Array();
        connections.length.should.be.above(0);
      } catch (error) {
        should.not.exist(error);
      }
    });
  }); // category end
  describe('interaction', async () => {
    @injectable
    class Car {
      public get collection() { return 'cars'; }
    }
    let car = di.getInstance('Car');
    car.id = 1;
    car.make = 'C4';
    car.engine = 'V6';
    car.gearbox = '5gear';
    let engine = {
      get collection() { return 'engines'; },
      id: car.engine,
      cylinders: parseInt(car.engine.slice(-1))
    };
    let gearbox = {
      get collection() { return 'transmissions'; },
      id: car.gearbox,
      gears: parseInt(car.gearbox.slice(0, 1))
    };
    before(async () => {
      try {
        await dbHandler.populationDatabases.save(engine);
        await dbHandler.populationDatabases.save(gearbox);
      }
      catch (error) {
        should.not.exist(error);
      }
    });
    it('should not store data in persistence layer (no collection)', async () => {
      try {
        let response = await dbHandler.persistenceDatabases.save({_id: 2, make: 'B8'});
        should.not.exist(response);
      } catch (error) {
        should.exist(error);
      }
    });
    it('should be possible to store data in persistence layer', async () => {
      try {
        let response = await dbHandler.persistenceDatabases.save(car);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should not read data from the persistence layer (no collection)', async () => {
      try {
        let response = await dbHandler.persistenceDatabases.find({_id: car.id}, undefined);
        should.not.exist(response);
      } catch (error) {
        should.exist(error);
      }
    });
    it('should be possible to read data from the persistence layer', async () => {
      try {
        let response = await dbHandler.persistenceDatabases.find({_id: car.id}, car.collection);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should fail to populate', async () => {
      let response;
      let errorObj = {engines: ['V2', 'V4']};
      try {
        response = await dbHandler.populationDatabases.populate(errorObj, ['engines'], ['engines']);
        should.not.exist(response);
      } catch (error) {
        should.exist(error);
        assert(error.engines && error.engines === errorObj.engines);
      }
      let partialErrorObj = {primaryEngine: 'V8', backupEngine: 'V6'};
      try {
        response = await dbHandler.populationDatabases.populate(partialErrorObj, ['primaryEngine', 'backupEngine'], ['engines', 'engines']);
        should.not.exist(response);
      } catch (error) {
        should.exist(error);
        assert(error.primaryEngine && error.primaryEngine === partialErrorObj.primaryEngine);
      }
    });
    it('should be possible to populate data', async () => {
      let response;
      try {
        response = await dbHandler.populationDatabases.populate(car, undefined, undefined);
        should.exist(response);
        response = await dbHandler.populationDatabases.populate({engines: ['V6', 'V6']}, ['engines'], ['engines']);
        should.exist(response);
        response = await dbHandler.populationDatabases.populate(car, ['engine', 'gearbox'], ['engines', 'transmissions']);
        should.exist(response);
        car = response;
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to store and populate data in the population layer', async () => {
      try {
        let response = await dbHandler.populationDatabases.save(car);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to read data from the population layer', async () => {
      try {
        let response = await dbHandler.populationDatabases.find({_id: car.id}, car.collection);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
  }); // category end
  after(async () => {
    for (let connection of dbHandler.connections) {
      try {
        await connection.database.dropDatabase();
      } catch (error) {
        should.not.exist(error);
      }
    }
  });
}); // test end
