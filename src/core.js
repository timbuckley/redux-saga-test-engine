'use strict'
const deepEqual = require('deep-equal')

const bool = o => !!o

const ioKey = '@@redux-saga/IO'

const isEffect = (obj, effects = []) =>
  bool(obj && obj[ioKey] === true && effects.includes(obj.type))

const isNestedEffect = (arr, effects = []) =>
  bool(arr && arr.every && arr.length > 0 && arr.every(element => isEffect(element, effects)))

const isNestedArray = arr =>
  bool(
    arr &&
    arr.every && // Is an array
      arr.every(subArr => subArr.length === 2) // Every array inside has exactly 2 elements.
  )

const isMap = m => bool(Object.prototype.toString.call(m) === '[object Map]')

const throwErrorKey = '@@redux-saga-test-engine/ERROR'

// check if consumer is yielding our effect to immediately cause the generator function to throw an error
const shouldThrowError = obj => isEffect(obj, [throwErrorKey])

const throwError = message => ({ [ioKey]: true, type: throwErrorKey, payload: message })

// Lifted from https://github.com/tj/co/blob/717b043371ba057cb7a4a2a4e47120d598116ed7/index.js#L221
function isGeneratorFunction(obj) {
  const { constructor } = obj || {}
  if (!constructor) return false
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) {
    return true
  }
  return false
}

function assert(condition, message) {
  if (!condition) {
    if (typeof Error !== 'undefined') {
      throw new Error(message || 'Assertion failed')
    }
  }
}

// Returns value in mapping corresponding to matching searchVal key.
function getNextVal(searchVal, mapping) {
  let value
  if (isMap(mapping)) {
    for (let [key, val] of mapping.entries()) {
      if (deepEqual(key, searchVal)) {
        value = val
        break
      }
    }
  } else {
    value = (mapping.find(keyVal => deepEqual(keyVal[0], searchVal)) || [])[1]
  }

  if (typeof value === 'function' && value._isReduxSagaTestEngineStub) {
    return value()
  }
  return value
}

// Used to stringify yielded values. Output includes functions
function stringifyVal(val) {
  return JSON.stringify(
    val,
    (key, val) => {
      if (typeof val === 'function') {
        if (val.name) {
          return `[Function: ${val.name}]: ${val.toString()}`
        } else {
          return `[Function]: ${val.toString()}`
        }
      }
      return val
    },
    2
  )
}

const stub = (genFunc, ...args) => {
  if (isGeneratorFunction(genFunc)) {
    const gen = genFunc(...args)
    const stubFunc = () => gen.next().value
    stubFunc._isReduxSagaTestEngineStub = true
    return stubFunc
  } else {
    const stubFunc = () => genFunc(...args)
    stubFunc._isReduxSagaTestEngineStub = true
    return stubFunc
  }
}

const MAX_STEPS = 1000

// Creates sagaTestEngine that collects yielded effects specified by the effects argument
const createSagaTestEngine = (effects = ['PUT']) => (...args) => sagaTestEngine(effects, ...args)

const collectPuts = createSagaTestEngine(['PUT'])
const collectCalls = createSagaTestEngine(['CALL'])
const collectCallsAndPuts = createSagaTestEngine(['CALL', 'PUT'])

function sagaTestEngine(effects, genFunc, opts, ...initialArgs) {
  assert(isGeneratorFunction(genFunc), 'The first parameter must be a generator function.')

  let options = opts
  if (isMap(opts) || isNestedArray(opts)) {
    options = { mapping: opts }
  } else {
    options = opts
  }

  const envMapping = options.mapping
  const collectedEffects = options.collected || []

  assert(
    isMap(envMapping) || isNestedArray(envMapping),
    'The second parameter must be a nested array, ' +
      'Map or object containing the same under `mapping` key'
  )

  const mapping = [...envMapping, [undefined, undefined]]
  const gen = genFunc(...initialArgs)
  let val = undefined
  let isDone = false
  let counter = 0

  while (!isDone) {
    const nextVal = getNextVal(val, mapping)
    const throwError = shouldThrowError(nextVal)
    let genResult

    // Yielded value must appear in mapping, or be a PUT Effect.
    const isFirstLoop = counter === 0
    const nextValFound = nextVal !== undefined
    const yieldedUndefined = val === undefined
    const yieldedEffectShouldBeCollected = isEffect(val, effects) || isNestedEffect(val, effects)
    assert(
      isFirstLoop || nextValFound || yieldedUndefined || yieldedEffectShouldBeCollected,
      `Env Mapping is missing a value for ${stringifyVal(val)}`
    )

    if (throwError) {
      genResult = gen.throw(nextVal.payload || 'ERROR')
    } else {
      genResult = gen.next(nextVal)
    }

    val = genResult.value
    isDone = genResult.done

    if (isEffect(val, effects) || isNestedEffect(val, effects)) {
      collectedEffects.push(val)
    }
    counter += 1

    if (counter > (options.maxSteps || MAX_STEPS)) {
      throw new Error(`Exceeded maxSteps(${options.maxSteps || MAX_STEPS}) limit`)
    }
  }
  return collectedEffects
}

module.exports = {
  createSagaTestEngine,
  sagaTestEngine,
  collectPuts,
  collectCalls,
  collectCallsAndPuts,
  isEffect,
  isNestedEffect,
  isNestedArray,
  getNextVal,
  assert,
  stringifyVal,
  throwError,
  shouldThrowError,
  stub,
}
