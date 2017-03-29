[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage percentage][coveralls-image]][coveralls-url]

[npm-image]: https://badge.fury.io/js/%40molecuel%2Fdatabase.svg
[npm-url]: https://npmjs.org/package/@molecuel/database
[travis-image]: https://travis-ci.org/molecuel/database.svg?branch=master
[travis-url]: https://travis-ci.org/molecuel/database
[daviddm-image]: https://david-dm.org/molecuel/database.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/molecuel/database
[coveralls-image]: https://coveralls.io/repos/molecuel/database/badge.svg
[coveralls-url]: https://coveralls.io/r/molecuel/database

# Database module for molecuel framework

@molecuel/database is a general database management module, able to  manage all database libraries or classes adhering to @molecuel/core's IMlclDatabase interface definition and made injectable via @molecuel/di.
It's initialization is based on the @molecuel/di dependency injection module and it exists as a singleton.

## Initialization

To use it, simply include its import in the di's bootstrap and get the singleton instance by name.
You can then add configurations based on any object with respective properties and connect to databases (e.g. MongoDb).

```typescript
import { di } from '@molecuel/di';
import { MlclCore } from '@molecuel/core';
import { MlclDatabase, PERSISTENCE_LAYER, POPULATION_LAYER } from '@molecuel/database';
import { MlclMongoDb } from '@molecuel/mongodb';

di.bootstrap(MlclCore, MlclDatabase, MlclMongoDb);

let dbHandler: MlclDatabase = di.getInstance('MlclDatabase');
let config: any = {
  databases: [{
    name: 'mongodb_pers',
    type: 'MlclMongoDb',
    uri: 'mongodb://localhost/mongodb_persistence',
    layer: PERSISTENCE_LAYER,
    idPattern: '_id'
  },
  {
    name: 'mongodb_popul',
    type: 'MlclMongoDb',
    uri: 'mongodb://localhost/mongodb_population',
    layer: POPULATION_LAYER
  }]
};

dbHandler.addDatabasesFrom(config);
(async () => {
 await dbHandler.init();
})();
```

## Handling connected databases

You can then interact with all (or some) connected databases, e.g.:

```typescript
import { injectable } from '@molecuel/di';

@injectable
class Engine {
  public static get collection(): string { return 'engines'; }
  public _id: any;
  public cylinders: number;
}
@injectable
class Car {
  public get collection(): string { return 'cars'; }
  public engine: Engine;
  public _id: any;
  constructor(engine: Engine) {
    this.engine = engine;
  }
}

(async () => {
    await dbHandler.init();
    let someEngine: Engine = di.getInstance('Engine');
    someEngine.cylinders = 6;
    let saved: any = await dbHandler.save(someEngine);
    someEngine._id = saved.successes.find((o) => o)._id;

    let someCar: Car = di.getInstance('Car');
    someCar.engine = someEngine._id;
    saved = await dbHandler.persistenceDatabases.save(someCar);
    someCar._id = saved.successes.find((o) => o)._id;

    someCar = await dbHandler.populate(someCar, ['engine'], [Engine.collection]);
    saved = await dbHandler.populationDatabases.save(someCar);

    let carsOnDB: any[] = await dbHandler.persistenceDatabases.find(
      {engine: someEngine._id.toString()},
      someCar.collection );
    console.log(carsOnDB[0] && carsOnDB[0]._id.toString() === someCar._id.toString()); // true
    for (let con of dbHandler.connections) {
      if (con && con.database) {
        await con.database.dropDatabase();
      }
    }
})();
```
