'use strict'

const { select, call, put } = require('redux-saga/effects')
// ------------ Example ------------

const getGlobalState = () => ({
  user: { id: 'user1' },
  token: 'token',
})

const favItem = () => ({})
const sucessfulFavItemAction = (...args) => args
const receivedFavItemErrorAction = (...args) => args
const loadingFavItemAction = (...args) => args

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

function* sagaWithNoPuts() {
  const { token, user } = yield select(getGlobalState)

  yield call(favItem, token, user)
}

function* sagaWithNestedSaga(action) {
  yield put(loadingFavItemAction(true))

  yield* favSagaWorker(action)

  yield put(loadingFavItemAction(false))
}

module.exports = {
  favSagaWorker,
  sagaWithNoPuts,
  sagaWithNestedSaga,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction,
  loadingFavItemAction,
}
