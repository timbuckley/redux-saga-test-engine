'use strict'

const { delay } = require('redux-saga')
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

function* retryFavSagaWorker(action) {
  const { itemId } = action.payload
  const { token, user } = yield select(getGlobalState)

  let attempt = 0
  while (attempt++ < 5) {
    try {
      const response = yield call(favItem, itemId, token)
      const json = yield response.json()
      yield put(sucessfulFavItemAction(json, itemId, user))
      break
    } catch (e) {
      yield put(receivedFavItemErrorAction(e, itemId))
      yield call(delay, 2000)
    }
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
  retryFavSagaWorker,
  sagaWithNoPuts,
  sagaWithNestedSaga,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction,
  loadingFavItemAction,
}
