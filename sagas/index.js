'use strict'

const { select, call, put } = require('redux-saga/effects')
// ------------ Example ------------

const getGlobalState = () => ({
  user: {id: 'user1'},
  token: 'token'
})

const favItem = () => ({})
const sucessfulFavItemAction = (...args) => args
const receivedFavItemErrorAction = (...args) => args

// Example saga to be tested.
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

module.exports = {
  favSagaWorker,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction
}
