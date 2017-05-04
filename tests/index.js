'use strict'

const test = require('ava')
const {
  collectPuts,
  collectCalls,
  collectCallsAndPuts,
  isEffect,
  isNestedArray,
  getNextVal,
  isNestedEffect,
} = require('../src')
const {
  favSagaWorker,
  sagaWithNoPuts,
  sagaWithNestedSaga,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction,
  loadingFavItemAction,
} = require('../sagas')
const { select, call, put } = require('redux-saga/effects')

const sagaTestEngine = collectPuts

test('isEffect correctly identifies a PUT Saga Effect', t => {
  t.false(isEffect())
  t.false(isEffect({}, ['PUT']))
  t.false(isEffect(put, ['PUT']))
  t.false(isEffect(call, ['PUT']))
  t.false(isEffect(select, ['PUT']))
  t.false(isEffect(call(() => 'call'), ['PUT']))
  t.false(isEffect(select(() => 'select'), ['PUT']))
  t.false(isEffect({ CALL: 'someting' }, ['PUT']))

  t.true(isEffect(put({}), ['PUT']))
  t.true(isEffect({ PUT: 'someting' }, ['PUT']))
})

test('isEffect correctly identifies a CALL or PUT Saga Effect', t => {
  t.false(isEffect(put, ['PUT', 'CALL']))
  t.false(isEffect(call, ['PUT', 'CALL']))
  t.false(isEffect(select, ['PUT', 'CALL']))
  t.false(isEffect(select(() => 'select'), ['PUT', 'CALL']))
  t.false(isEffect({ CALL: 'someting' }, ['PUT']))

  t.true(isEffect(call(() => 'call'), ['PUT', 'CALL']))
  t.true(isEffect(put({}), ['PUT', 'CALL']))
  t.true(isEffect({ PUT: 'someting' }, ['PUT', 'CALL']))
  t.true(isEffect({ CALL: 'someting' }, ['PUT', 'CALL']))
})


test('isNestedEffect correctly identifies an array of PUT Saga Effects', t => {
  t.false(isNestedEffect())
  t.false(isNestedEffect({}, ['PUT']))
  t.false(isNestedEffect([], ['PUT']))
  t.false(isNestedEffect(put, ['PUT']))
  t.false(isNestedEffect(call, ['PUT']))
  t.false(isNestedEffect(select, ['PUT']))
  t.false(isNestedEffect(call(() => 'call'), ['PUT']))
  t.false(isNestedEffect(select(() => 'select'), ['PUT']))
  t.false(isNestedEffect({ CALL: 'someting' }, ['PUT']))
  t.false(isNestedEffect(put({}), ['PUT']))
  t.false(isNestedEffect({ PUT: 'someting' }), ['PUT'])

  t.true(isNestedEffect([{ PUT: 'someting' }], ['PUT']))
  t.true(isNestedEffect([put({})], ['PUT']))
  t.true(isNestedEffect([put({}), put({}), put({})], ['PUT']))

  t.false(isNestedEffect([call(() => 1)], ['PUT']))
  t.false(isNestedEffect([put({}), select(() => 1), put({})], ['PUT']))
})

test('isNestedEffect correctly identifies an array of PUT or CALL Saga Effects', t => {
  t.false(isNestedEffect())
  t.false(isNestedEffect({}, ['PUT', 'CALL']))
  t.false(isNestedEffect([], ['PUT', 'CALL']))
  t.false(isNestedEffect(put, ['PUT', 'CALL']))
  t.false(isNestedEffect(call, ['PUT', 'CALL']))
  t.false(isNestedEffect(select, ['PUT', 'CALL']))
  t.false(isNestedEffect(call(() => 'call'), ['PUT', 'CALL']))
  t.false(isNestedEffect(select(() => 'select'), ['PUT', 'CALL']))
  t.false(isNestedEffect({ CALL: 'someting' }, ['PUT', 'CALL']))
  t.false(isNestedEffect(put({}), ['PUT', 'CALL']))
  t.false(isNestedEffect({ PUT: 'someting' }), ['PUT', 'CALL'])

  t.true(isNestedEffect([{ PUT: 'someting' }], ['PUT', 'CALL']))
  t.true(isNestedEffect([put({})], ['PUT', 'CALL']))
  t.true(isNestedEffect([put({}), put({}), put({})], ['PUT', 'CALL']))
  t.true(isNestedEffect([{ CALL: 'someting' }], ['PUT', 'CALL']))
  t.true(isNestedEffect([call(() => 1)], ['PUT', 'CALL']))
  t.true(isNestedEffect([call(() => 1), put({}), put({})], ['PUT', 'CALL']))
  t.true(isNestedEffect([put({}), call(() => 1), put({})], ['PUT', 'CALL']))

  t.false(isNestedEffect([put({}), select(() => 1), put({})], ['PUT', 'CALL']))
  t.false(isNestedEffect([call(() => 1), select(() => 1), put({})], ['PUT', 'CALL']))
})


test('isNestedArray correctly identifies a nested array', t => {
  t.false(isNestedArray())
  t.false(isNestedArray(1))
  t.false(isNestedArray({}))
  t.false(isNestedArray([1]))
  t.false(isNestedArray([1, 2]))
  t.false(isNestedArray([[1], [2]]))
  t.false(isNestedArray([[1, 2], [3]]))
  t.false(isNestedArray(new Map([[1, 2], [3]])))

  t.true(isNestedArray([]), 'Empty array is allowed.')
  t.true(isNestedArray([['key', 'val']]))
  t.true(isNestedArray([['key', 'val']]))
  t.true(isNestedArray([[undefined, undefined]]))
})


test('getNextVal', t => {
  // Nested Array
  t.is(2, getNextVal(1, [[1, 2]]))
  t.is(2, getNextVal(1, [[1, 2], [1, 3]]))
  t.is(4, getNextVal(3, [[1, 2], [3, 4]]))
  t.is(
    'val',
    getNextVal(
      { a: { b: { c: 1 } } },
      [
        [{ a: { b: { c: 1 } } }, 'val']
      ]
    ),
    'Handled deeply-nested objects in arrays'
  )
  t.is(
    undefined,
    getNextVal(
      { a: { b: { c: 2 } } },
      [
        [{ a: { b: { c: 1 } } }, 'val']
      ]
    ),
    'Handled deeply-nested objects in arrays part 2'
  )

  // Map
  t.is(2, getNextVal(1, new Map([[1, 2]])))
  t.is(4, getNextVal(3, new Map([[1, 2], [3, 4]])))
  t.is(
    'val',
    getNextVal(
      { a: { b: { c: 1 } } },
      new Map([
        [{ a: { b: { c: 1 } } }, 'val']
      ])
    ),
    'Handled deeply-nested objects in Map'
  )
  t.is(
    undefined,
    getNextVal(
      { a: { b: { c: 2 } } },
      new Map([
        [{ a: { b: { c: 1 } } }, 'val']
      ])
    ),
    'Handled deeply-nested objects in Map part 2'
  )

  // Handles value not found.
  t.is(undefined, getNextVal(100, []))
  t.is(undefined, getNextVal(100, new Map([])))
  t.is(undefined, getNextVal(100, [[1, 2]]))
  t.is(undefined, getNextVal(100, new Map([[1, 2]])))
  t.is(undefined, getNextVal(undefined, []))
  t.is(undefined, getNextVal(undefined, new Map([])))
})

test('sagaTestEngine throws under bad conditions', t => {
  const genericGenFunc = function* () { }
  const generator = genericGenFunc()

  // First assert.
  t.throws(
    () => sagaTestEngine(),
    'The first parameter must be a generator function.')
  t.throws(
    () => sagaTestEngine(1),
    'The first parameter must be a generator function.')
  t.throws(
    () => sagaTestEngine(() => 1),
    'The first parameter must be a generator function.',
    'Handled non-generator functions')
  t.throws(
    () => sagaTestEngine(generator),
    'The first parameter must be a generator function.',
    'Cannot be a generator itself')

  // Second assert.
  t.throws(
    () => sagaTestEngine(genericGenFunc, 1),
    'The second parameter must be a nested array or Map.')
  t.throws(
    () => sagaTestEngine(genericGenFunc, [1]),
    'The second parameter must be a nested array or Map.')

  // Third assert.
  const f = function* () {
    yield 'key'
  }
  const badMapping = [['incorrect key', 'value']]
  t.throws(
    () => sagaTestEngine(f, badMapping),
    'Env Mapping is missing a value for "key"')

  // Bad mapping for saga that yields obj with anonymous function
  function namedFunction() { }
  const f2 = function* () {
    yield { func: namedFunction }
  }
  const badMapping2 = [['bad', 'mapping']]
  t.throws(
    () => sagaTestEngine(f2, badMapping2),
    `Env Mapping is missing a value for ${JSON.stringify({ "func": `[Function: namedFunction]: ${namedFunction.toString()}` }, null, 2)}`
  )

  // Bad mapping for saga that yields object with anonymous function
  const anonymousFunction = function () { return 'something' }
  // Skip the anonymous function test if this anonymous functon is named (done in newer node versions)
  if (!anonymousFunction.name) {
    const f3 = function* () {
      yield { func: anonymousFunction }
    }
    const badMapping3 = [['bad', 'mapping']]
    t.throws(
      () => sagaTestEngine(f3, badMapping3),
      `Env Mapping is missing a value for ${JSON.stringify({ func: `[Function]: ${anonymousFunction.toString()}` }, null, 2)}`
    )
  }

  // No errors thrown
  const goodMapping = [['key', 'value']]
  t.notThrows(() => sagaTestEngine(f, goodMapping))

  const f4 = function* () {
    yield 'key1'
    yield 'key2'
  }
  const goodMapping2 = [['key1', 'value1'], ['key2', 'value2']]
  t.notThrows(() => sagaTestEngine(f4, goodMapping2))

  const f5 = function* () {
    yield undefined
  }
  const goodMapping3 = [[undefined, undefined]]
  t.notThrows(() => sagaTestEngine(f5, goodMapping3))

  const f6 = function* () {
    yield [put({ a: 1 })]
  }
  t.notThrows(
    () => sagaTestEngine(f6, goodMapping3),
    'Correctly handles nested array of puts'
  )

  const f7 = function* () {
    yield [select(() => 1)]
  }
  t.throws(() => sagaTestEngine(f7, goodMapping3))
})


test('sagaTestEngine correctly handles array of PUTS', t => {
  const selectorFunc = () => 2
  function* sagaWithNestedPuts() {
    const someString = yield select(selectorFunc)
    yield [
      put({ a: 1 }),
      put({ b: 2 }),
      put({ c: someString }),
    ]
    yield put('another put')
  }

  const envMapping = [
    [select(selectorFunc), 'someString']
  ]

  t.deepEqual(
    sagaTestEngine(sagaWithNestedPuts, envMapping),
    [
      [
        put({ a: 1 }),
        put({ b: 2 }),
        put({ c: 'someString' }),
      ],
      put('another put'),
    ],
    'Result is a nested array of puts.'
  )
})


test('Example favSagaWorker with happy path works', t => {
  const itemId = '123'
  const token = '456'
  const user = { id: '321' }

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

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(sucessfulFavItemAction(favItemResp, itemId, user))],
    'Happy path'
  )
})


test('Example favSagaWorker with sad path works', t => {
  const itemId = '123'
  const token = '456'
  const user = { id: '321' }

  const favItemRespFail = new TypeError('TypeError: response.json is not a function')
  const favItemRespOBjFail = { json: () => { throw favItemRespFail } }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = [
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBjFail],
    [favItemRespFail, favItemRespFail]
  ]

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(receivedFavItemErrorAction(favItemRespFail, itemId))],
    'Not happy path'
  )
})


test('favSagaWorker works when given a Map', t => {
  const itemId = '123'
  const token = '456'
  const user = { id: '321' }

  const favItemResp = 'The favItem JSON response'
  const favItemRespOBj = { json: () => favItemResp }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = new Map([
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBj],
    [favItemResp, favItemResp]
  ])

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(sucessfulFavItemAction(favItemResp, itemId, user))],
    'Maps work'
  )
})

test('sagaTestEngine finds PUTs from yielded saga', t => {
  const itemId = '123'
  const token = '456'
  const user = { id: '321' }

  const favItemResp = 'The favItem JSON response'
  const favItemRespOBj = { json: () => favItemResp }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = [
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBj],
    [favItemResp, favItemResp],
  ]

  t.deepEqual(
    sagaTestEngine(sagaWithNestedSaga, ENV, FAV_ACTION),
    [
      put(loadingFavItemAction(true)),
      put(sucessfulFavItemAction(favItemResp, itemId, user)),
      put(loadingFavItemAction(false)),
    ],
    'Actions dispatched from nested saga'
  )
})

test('collectCalls finds CALLs from saga', t => {
  const token = '456'
  const user = { id: '321' }

  const ENV = [
    [select(getGlobalState), { user, token }]
  ]

  t.deepEqual(
    collectCalls(sagaWithNoPuts, ENV),
    [call(favItem, token, user)],
    'Collected call effect from saga'
  )
})

test('collectCallsAndPuts finds CALLs and PUTs from saga', t => {
  const itemId = '123'
  const token = '456'
  const user = { id: '321' }

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

  t.deepEqual(
    collectCallsAndPuts(favSagaWorker, ENV, FAV_ACTION),
    [
      call(favItem, itemId, token),
      put(sucessfulFavItemAction(favItemResp, itemId, user))
    ],
    'Collected call and put effects from saga'
  )
})