# Redux Saga Test Engine
![Circle CI Status Shield](https://circleci.com/gh/DNAinfo/redux-saga-test-engine.png?style=shield&circle-token=2aa98ed43cdd0fcf890f955d7e203e663edba01c)

Test your `redux-saga` generator functions with less pain.

## Installation

With `npm`:
```
npm install redux-saga-test-engine --save-dev
```

With `yarn`:
```bash
yarn add redux-saga-test-engine --dev
```

## Usage

```js
const sagaTestEngine = require('redux-saga-test-engine')


const actualPuts = sagaTestEngine(
  // This is the saga we are testing.
  sagaToTest,

  // The environment mapping of redux effect calls to their corresponding yielded value.
  // If the `sagaTestEngine` encounters a non-`put` yielded in the saga, it
  // needs to be told what to yield. Worth noting here that the order does
  // NOT matter, as long as you don't have duplicate keys.
  [
    [select(getPuppy), {barks: true, cute: 'Definitely'}],
    [call(API.doWeLovePuppies), {answer: 'Of course we do!'}]
  ],

  // Optional. All remaining arguments are given direct arguments to `sagaToTest` itself.
  // Typically it is the action that triggers the saga worker function.
  initialAction
)

actualPuts
// [
//   put(petPuppy(puppy)),
//   put(hugPuppy(puppy))
// ]
```


## Full Example

```js
// favSaga.js
function* favSagaWorker(action) {
  const { itemId } = action.payload
  const { token, user } = yield select(getGlobalState)

  try {
    const response = yield call(favItem, itemId, token)
    const json = yield response.json()
    yield put(sucessfulFavItemAction(json, itemId, user))
  } catch (e) {
    yield put(receivedFavItemErrorAction(e, itemId))
  }
}
```

```js
// favSaga.spec.js
const test = require('ava')
const runGenfunc = require('redux-saga-test-engine')
const {
  favSagaWorker,
  getGlobalState,
  favItem,
  sucessfulFavItemAction
} = require('../sagas')

const { select, call, put } = require('redux-saga/effects')

test('favSagaWorker', t => {
  const itemId = '123'
  const token = '456'
  const user = {id: '321'}

  const favItemResp = 'The favItem JSON response'
  const favItemRespOBj = { json: () => favItemResp }


  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = [
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBj],
    [favItemResp, favItemResp]
  ]

  const expected = [put(sucessfulFavItemAction(favItemResp, itemId, user))]
  const actual = runGenfunc((favSagaWorker), ENV, FAV_ACTION)

  t.deepEqual(
    actual,
    expected,
    'We should see the `sucessfulFavItemAction` dispatched with the correct information'
  )
})
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

### Q: Why not use a `Map`?
**A**: Maps only work if the key is referencing the same object (ie `obj1 === obj2`), even if their values are the same.

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

### Q: I know a better way.
**A**: Awesome, please show us!

## License

  [MIT](LICENSE.txt)
