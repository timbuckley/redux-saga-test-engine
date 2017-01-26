const test = require('ava')
const { runGenfunc } = require('../src')
const {
  favSagaWorker,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction
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

  t.deepEqual(
    runGenfunc((favSagaWorker), ENV, FAV_ACTION),
    [put(sucessfulFavItemAction(favItemResp, itemId, user))],
    'Happy path'
  )
})



test('favSagaWorker: Raise an exception', t => {
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
    runGenfunc((favSagaWorker), ENV, FAV_ACTION),
    [put(receivedFavItemErrorAction(favItemRespFail, itemId))],
    'Not happy path'
  )
})
