'use strict'

const test = require('ava')
const {
  sagaTestEngine,
  isPut,
  isNestedArray,
} = require('../src')
const {
  favSagaWorker,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction
} = require('../sagas')
const { select, call, put } = require('redux-saga/effects')


test('isPut correctly identifies a PUT Saga Effect', t => {
  t.false(isPut())
  t.false(isPut({}))
  t.false(isPut(put))
  t.false(isPut(call))
  t.false(isPut(select))
  t.false(isPut(call(() => 'call')))
  t.false(isPut(select(() => 'select')))
  t.false(isPut({CALL: 'someting'}))

  t.true(isPut(put({})))
  t.true(isPut({PUT: 'someting'}))
})


test('isNestedArray correctly identifies a nested array', t => {
  t.false(isNestedArray())
  t.false(isNestedArray(1))
  t.false(isNestedArray({}))
  t.false(isNestedArray([1]))
  t.false(isNestedArray([1, 2]))
  t.false(isNestedArray([[1], [2]]))
  t.false(isNestedArray([[1, 2], [3]]))

  t.true(isNestedArray([]), 'Empty array is allowed.')
  t.true(isNestedArray([['key', 'val']]))
  t.true(isNestedArray([['key', 'val']]))
  t.true(isNestedArray([[undefined, undefined]]))
})


test('sagaTestEngine throws under bad conditions', t => {
  const genericGenFunc = function*() {}
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
    'The second parameter must be a nested array.')
  t.throws(
    () => sagaTestEngine(genericGenFunc, [1]),
    'The second parameter must be a nested array.')

  // Third assert.
  const f = function*() {
    yield 'key'
  }
  const badMapping = [['incorrect key', 'value']]
  t.throws(
    () => sagaTestEngine(f, badMapping),
    'Env Mapping is missing a value for "key"')

  // No errors thrown
  const goodMapping = [['key', 'value']]
  t.notThrows(() => sagaTestEngine(f, goodMapping))

  const f2 = function*() {
    yield 'key1'
    yield 'key2'
  }
  const goodMapping2 = [['key1', 'value1'], ['key2', 'value2']]
  t.notThrows(() => sagaTestEngine(f2, goodMapping2))

  const f3 = function*() {
    yield undefined
  }
  const goodMapping3 = [[undefined, undefined]]
  t.notThrows(() => sagaTestEngine(f3, goodMapping3))

})


test('Example favSagaWorker with happy path works', t => {
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

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(sucessfulFavItemAction(favItemResp, itemId, user))],
    'Happy path'
  )
})


test('Example favSagaWorker with sad path works', t => {
  const itemId = '123'
  const token = '456'
  const user = {id: '321'}

  const favItemRespFail = new TypeError('TypeError: response.json is not a function')
  const favItemRespOBjFail = { json: () => {throw favItemRespFail} }

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
