'use strict';
import 'reflect-metadata';
import * as should from 'should';
import * as assert from 'assert';
// import * as _ from 'lodash';
import {di, injectable} from '@molecuel/di';
import {MlclCore} from '@molecuel/core';
import {MlclMongoDb} from '@molecuel/mongodb';
import {MlclDatabase, PERSISTENCE_LAYER, POPULATION_LAYER} from '../dist';
// import {Subject, Observable} from '@reactivex/rxjs';

let config: any = {
  molecuel: {
    database: {
      name: 'mongodb_pers',
      type: 'MlclMongoDb',
      uri: 'mongodb://localhost/mongodb_persistence_test',
      layer: PERSISTENCE_LAYER,
      idPattern: '_id'
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
    it('should not have any connections upon init without configs', async () => {
      dbHandler = di.getInstance('MlclDatabase');
        assert(dbHandler);
        dbHandler.should.be.instanceOf(MlclDatabase);
        await dbHandler.init();
        should.not.exist(dbHandler.connections);
    });
    it('should be possible to load the database config', () => {
      try {
        dbHandler.addDatabasesFrom(config);
        (<any>dbHandler).configs.should.be.an.Array();
        (<any>dbHandler).configs.length.should.be.above(0);
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
        connections.length.should.be.aboveOrEqual(2);
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
    let rollbackCar;
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
        await dbHandler.save(engine);
        await dbHandler.save(gearbox);
      }
      catch (error) {
        should.not.exist(error);
      }
    });
    it('should not store data in persistence layer (no collection; empty object)', async () => {
      let response;
      try {
        response = await dbHandler.persistenceDatabases.save({id: 2, make: 'B8'});
      } catch (error) {
        should.exist(error);
      }
      should.not.exist(response);
      try {
        response = await dbHandler.persistenceDatabases.save({});
      } catch (error) {
        should.exist(error);
      }
      should.not.exist(response);
    });
    it('should be possible to store data in persistence layer', async () => {
      let response;
      try {
        response = await dbHandler.persistenceDatabases.save(car);
      } catch (error) {
        should.not.exist(error);
      }
      should.exist(response);
      should.exist(response.successes);
      should.exist(response.successes[0]);
      car.id.should.equal(response.successes[0]._id);
      car.make.should.equal(response.successes[0].make);
      car.engine.should.equal(response.successes[0].engine);
      car.gearbox.should.equal(response.successes[0].gearbox);
    });
    it('should not read data from the persistence layer (no collection)', async () => {
      let response;
      try {
        response = await dbHandler.persistenceDatabases.find({_id: car.id}, undefined);
      } catch (error) {
        should.exist(error);
      }
      should.not.exist(response);
    });
    it('should be possible to read data from the persistence layer', async () => {
      let response;
      try {
        response = await dbHandler.persistenceDatabases.find({id: car.id}, car.collection);
      } catch (error) {
        should.not.exist(error);
      }
      should.exist(response);
    });
    it('should fail to populate non-saved references', async () => {
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
        response = await dbHandler.populationDatabases.populate({engines: ['V6', 'V6', 'V10']}, ['engines'], ['engines']);
        should.exist(response);
        response = await dbHandler.populationDatabases.populate(car, ['engine', 'gearbox'], ['engines', 'transmissions']);
        should.exist(response);
        car = response;
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to store populated data in the population layer', async () => {
      let response;
      try {
        response = await dbHandler.populationDatabases.save(car);
      } catch (error) {
        should.not.exist(error);
      }
      should.exist(response);
    });
    it('should be possible to read data from the population layer', async () => {
      let response;
      try {
        response = await dbHandler.populationDatabases.find({_id: car.id}, car.collection);
      } catch (error) {
        should.not.exist(error);
      }
      should.exist(response);
    });
    // it('should fail rolling back', async () => {
    //   let response;
    //   try {
    //     response = await dbHandler.save({ _id: 1, collection: 'robots', beep: 'boop' });
    //   } catch (error) {
    //     should.exist(error);
    //     console.log(error);
    //     should.exist(error.message);
    //     error.message.should.containEql('Rollback failed');
    //   }
    //   should.not.exist(response);
    // });
    it('should roll back completed save operations after a failing one', async () => {
      let response;
      rollbackCar = di.getInstance('Car');
      rollbackCar.id = 99;
      rollbackCar.make = 'OOOO';
      rollbackCar.engine = car.engine._id;
      rollbackCar.gearbox = car.gearbox._id;
      try {
        response = await dbHandler.save(rollbackCar);
      } catch (error) {
        should.not.exist(error);
      }
      should.exist(response);
      should.exist(response.successCount);
      response.successCount.should.equal(dbHandler.connections.length);
      response = undefined;
      rollbackCar.make = 'IIII';
      try {
        await dbHandler.connections[1].database.close();
        response = await dbHandler.save(rollbackCar);
      } catch (error) {
        should.exist(error);
        should.exist(error.message);
        error.message.should.containEql('Rollback successful');
      }
      finally {
        await dbHandler.connections[1].database.open();
      }
      should.not.exist(response);
    });
    it('should fail saving on disconnected databases and not start a rollback (explicit suppression)', async () => {
      let response;
      try {
        for (let con of dbHandler.connections) {
          await con.database.close();
        }
        response = await dbHandler.save(car, undefined, undefined, false);
      } catch (error) {
        should.exist(error);
        should.exist(error.errors);
        should.exist(error.errorCount);
        error.errors.length.should.equal(dbHandler.connections.length);
        error.errorCount.should.equal(error.errors.length);
      }
      finally {
        for (let con of dbHandler.connections) {
          await con.database.open();
        }
      }
      should.not.exist(response);
      // should.not.exist(response.message);
    });
  }); // category end
  after(async () => {
    for (let connection of dbHandler.connections) {
      try {
        // await connection.database.dropDatabase();
      } catch (error) {
        should.not.exist(error);
      }
    }
  });
}); // test end
