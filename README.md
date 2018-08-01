# Redux Saga Test Engine
[![npm](https://badge.fury.io/js/redux-saga-test-engine.svg)](https://badge.fury.io/js/redux-saga-test-engine) [![CircleCI](https://circleci.com/gh/timbuckley/redux-saga-test-engine.svg?style=svg)](https://circleci.com/gh/timbuckley/redux-saga-test-engine)


Test your `redux-saga` generator functions with less pain.

## Contents
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
  - [Full Example](#full-example)
  - [API](#api)
  - [FAQ](#faq)
    - [Q: What's the deal with this?](#q-whats-the-deal-with-this)
    - [Q: How to test saga that is expected to throw exception?](#how-to-test-saga-that-is-expected-to-throw-exception)
    - [Q: Why not just use redux-saga-test?](#q-why-not-just-use-redux-saga-test)
    - [Q: Why not just use redux-saga-test-plan?](#q-why-not-just-use-redux-saga-test-plan)
    - [Q: Why not just do it manually?](#q-why-not-just-do-it-manually-example)
    - [Q: Why not use a Map for the second argument (the envMapping)?](#q-why-not-use-a-map-for-the-second-argument-the-envmapping)
    - [Q: I know a better way](#q-i-know-a-better-way)
  - [License](#license)

## Installation

With `npm`:
```
npm install redux-saga-test-engine --save-dev
```

With `yarn`:
```bash
yarn add redux-saga-test-engine --dev
```

## Basic Usage

```js
const { createSagaTestEngine } = require('redux-saga-test-engine')

// Choose which effect types you want to collect from the saga.
const collectEffects = createSagaTestEngine(['PUT', 'CALL'])

const actualEffects = collectEffects(
  // This is the saga we are testing.
  sagaToTest,

  // The environment mapping of redux effect calls to their corresponding yielded value.
  // If the the collector function encounters a non-`put` yielded in the saga,
  // it needs to be told what to yield. Worth noting here that the order does NOT
  // matter, as long as you don't have duplicate keys.
  [
    [select(getPuppy), { barks: true, cute: 'Definitely' }],
    [call(API.doWeLovePuppies), { answer: 'Of course we do!' }]
  ],

  // Optional. All remaining arguments are given direct arguments to `sagaToTest` itself.
  // Typically it is the action that triggers the saga worker function.
  initialAction
)

actualEffects
// [
//   call(API.doWeLovePuppies),
//   put(petPuppy(puppy)),
//   put(hugPuppy(puppy))
// ]
```


## Full Example

```js
// favSaga.js
function* retryFavSagaWorker(action) {
  const { itemId } = action.payload
  const { token, user } = yield select(getGlobalState)

  let attempt = 0
  while (attempt++ < 5) {
    try {
      const response = yield call(favItem, itemId, token)
      const json = yield response.json()
      yield put(successfulFavItemAction(json, itemId, user))
      break
    } catch (e) {
      yield put(receivedFavItemErrorAction(e, itemId))
      yield call(delay, 2000)
    }
  }
}
```

```js
// favSaga.spec.js
const test = require('ava')
const { collectPuts, stub, throwError } = require('redux-saga-test-engine')
const {
  retryFavSagaWorker,
  getGlobalState,
  favItem,
  successfulFavItemAction,
  receivedFavItemErrorAction,
} = require('../sagas')

const { delay } = require('redux-saga')
const { select, call, put } = require('redux-saga/effects')

test('retryFavSagaWorker', t => {
  const itemId = '123'
  const token = '456'
  const user = { id: '321' }

  const favItemResp = 'The favItem JSON response'
  const favItemRespObj = { json: () => favItemResp }

  const favItemRespFail = new TypeError('TypeError: response.json is not a function')
  const favItemRespObjFail = { json: () => { throw favItemRespFail } }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = [
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), stub(function* () {
      yield favItemRespObjFail
      yield favItemRespObj
    })],
    [call(delay, 2000), '__elapsed__']
  ]

  const actual = collectPuts((retryFavSagaWorker), ENV, FAV_ACTION)
  const expected = [
    put(receivedFavItemErrorAction(favItemRespFail, itemId)),
    put(successfulFavItemAction(favItemResp, itemId, user)),
  ]

  t.deepEqual(
    actual,
    expected,
    'We should see the `receivedFavItemErrorAction` and `successfulFavItemAction` dispatched with the correct information'
  )
})
```

## API

```js
const {
  // Creates a collector function to collect arbitrary effects.
  // Example:
  //    const getPuts = createSagaTestEngine(['PUT'])
  createSagaTestEngine,

  // Convenient pre-filled collector functions to collect PUTs, CALLs, or both.
  collectPuts,
  collectCalls,
  collectCallsAndPuts,

  // Helper method.
  // If used as a value in the mapping, it throws an error inside the saga function
  // when the corresponding effect is found in the saga. If inside a try-catch,
  // the argument provided to throwError will be passed to the catch function.
  throwError,

  // Helper method.
  // When used as value in the mapping, it can return different values on each call,
  // defined by passed generator function.
  stub,
} = require('redux-saga-test-engine')
```


## FAQ

### Q: What's the deal with this?
**A**: It's annoying to test sagas. To do them by hand, you have iterate through the generator function by hand, passing in the next value to continue it along. This makes the tests much more verbose than the sagas themselves, in which case you are more likely to have bugs in the saga tests than the sagas. It's also very dependent on the exact order `yield`s occur in the saga, which make them unnecessarily brittle.

This library has the understanding that the main thing you care about testing for your sagas is what actions are dispatched (ie your `yield put(...)`'s), and in what order. Your `select`s, `call`s, etc can be thought of as your "inputs", and the `put`s can be thought of as the "outputs" of your saga.

Therefore, the arguments to the engine provided is:

1. The function you are testing,
2. A "map" of your environment along with their resulting values, and
3. Whatever other arguments should initialize the saga worker (optional).

...and the output is an array of `put(...)` effect objects as they occur.

### Q: How to test saga that is expected to throw exception?
**A**: In some cases is useful saga to throw exceptions, for example when it is part of bigger composed saga chain. As this library is testing framework agnostic it should propagate saga exceptions up and this makes it no longer possible to receive collected 'PUT's as function result. To solve this problem we can pass empty `collected` array as argument to `collectPuts` function and inspect the content after the test run. The second argument (the `envMapping`) can accept `options` object, see the following `ava` test example:

```js
test('Example throwFavSagaWorker with throwError effect follows sad path', t => {
  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId: 123 },
  }

  const mapping = [
    [call(favItem, itemId, token), throwError('ERROR')],
  ]

  // empty array reference
  const collected = []

  const options = {
    mapping,
    collected,
  }

  // expect to throw exception
  t.throws(() => {
    collectPuts(throwFavSagaWorker, options, FAV_ACTION)
  })

  t.deepEqual(
    collected,
    [put(receivedFavItemErrorAction('ERROR', 123))],
    'Not happy path'
  )
})
```

### Q: Why not just use [`redux-saga-test`](https://github.com/stoeffel/redux-saga-test)?
**A**: Lets see how one uses it:

```js
const fromGenerator = require('redux-saga-test');

test('saga', (t) => {
  const expect = fromGenerator(t, testSaga()) // <= pass your assert library with a `deepEqual` method.

  expect.next().put({type: 'FETCHING'})
  expect.next().call(loadData)
  expect.next(mockData).put({type: 'FETCHED', payload: mockData})
  expect.next().returns()
})
```

It's great that it cuts down on verbosity. But, as you can see, the exact order of the yielded Call and Put effects in the saga matter for the test, and then mockData has to be passed into the right spot (notably, in the `next(mockData)` after the `call(loadData)`, which is the correct but confusing ordering). That makes them more brittle than necessary, and not as declarative as possible. Also you have to directly insert your assertion library with deepEqual library, which is a bit magical.

### Q: Why not just use [`redux-saga-test-plan`](https://github.com/jfairbank/redux-saga-test-plan)?
**A**: Largely the same reasons as for `redux-saga-test` above. To the example usage!

```js
saga
  .next() // advance saga with `next()`
  .take('HELLO') // assert that the saga yields `take` with `'HELLO'` as type
  .next(action) // pass back in a value to a saga after it yields
  .put({ type: 'ADD', payload: 42 }) // assert that the saga yields `put` with the expected action
  .next()
  .call(identity, action) // assert that the saga yields a `call` to `identity` with the `action` argument
  .next()
  .isDone(); // assert that the saga is finished
```
Again, annoyingly needs to handle the `next` manually, passing in the next value. Depending on exact ordering is a drag. So is manually inserting the generated value into the next `next`. Not recommended, would not test with again.

### Q: Why not just do it manually ([example](http://instea.sk/2016/09/testing-side-effects-using-redux-saga/))?
**A**: Sure, if you want. It's just tedious and brittle for the same reasons mentioned in the previous two questions.

```js
it('should cancel login task', () => {
  const generator = loginFlow()
  assert.deepEqual(
    generator.next().value,
    take('LOGIN_REQUEST'),
    'waiting for login request'
  )

  const credentials = { name: 'kitty', password: 'secret' }
  assert.deepEqual(
    generator.next(credentials).value,
    fork(authorize, credentials.user, credentials.password),
    'authorizing user'
  )

  const task = createMockTask()
  assert.deepEqual(
    generator.next(task).value,
    take([ 'LOGOUT', 'LOGIN_ERROR' ]),
    'waiting for logout or login error'
  )

  const action = { type: 'LOGOUT' }
  assert.deepEqual(
    generator.next(action).value,
    cancel(task),
    'cancelling login'
  )

  assert.deepEqual(
    generator.next().value,
    call(clearSession),
    'clearing session'
  )
})
```

### Q: Why not use a `Map` for the second argument (the `envMapping`)?
**A**:
_**NOTE**: The collector functions now accept a `Map` as well as a nested array. But it isn't actually helpful, as described below._

Maps only work if the key is referencing the identical object (ie `a === b`), even if their values are the same (ie `deepEqual(a, b)`). Thus a corresponding `select(...)` value, for example, would not be found merely by using `envMap.get(select(...))`. Instead, the keys must be traversed though - and so it's no more helpful to use a Map than a simple nested Array.

### Q: I know a better way.
**A**: Awesome, please show us!

## License

  [MIT](LICENSE.txt)
