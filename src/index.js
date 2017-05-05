'use strict'
const deepEqual = require('deep-equal')


const bool = o => !!o

const isEffect = (obj, effects = []) => bool(
  obj &&
  Object.keys(obj).some((key) => effects.includes(key))
)

const isNestedEffect = (arr, effects = []) => bool(
  arr &&
  arr.every &&
  arr.length > 0 &&
  arr.every(element => isEffect(element, effects))
)

const isNestedArray = arr => bool(
  arr &&
  arr.every && // Is an array
  arr.every(subArr => subArr.length === 2) // Every array inside has exactly 2 elements.
)

const isMap = m => bool(Object.prototype.toString.call(m) === '[object Map]')

// check if consumer is yielding our effect to immediatly cause the generator function to throw an error
const shouldThrowError = obj => bool(obj && Object.keys(obj).includes('@THROW'))

const throwError = message => ({ '@THROW': message })

// Lifted from https://github.com/tj/co/blob/717b043371ba057cb7a4a2a4e47120d598116ed7/index.js#L221
function isGeneratorFunction(obj) {
  const { constructor } = (obj || {})
  if (!constructor) return false
  if (
    'GeneratorFunction' === constructor.name ||
    'GeneratorFunction' === constructor.displayName
  ) {
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
  if (isMap(mapping)) {
    for (let [key, value] of mapping.entries()) {
      if (deepEqual(key, searchVal)) {
        return value
      }
    }
    return undefined
  } else {
    return (mapping.find(keyVal => deepEqual(keyVal[0], searchVal)) || [])[1]
  }
}

// Used to stringify yielded values. Output includes functions
function stringifyVal(val) {
  return JSON.stringify(val, (key, val) => {
    if (typeof val === 'function') {
      if (val.name) {
        return `[Function: ${val.name}]: ${val.toString()}`
      } else {
        return `[Function]: ${val.toString()}`
      }
    }
    return val
  }, 2)
}

// Creates sagaTestEngine that collects yielded effects specified by the effects argument
const createSagaTestEngine = (effects = ['PUT']) => (...args) => sagaTestEngine(effects, ...args)

const collectPuts = createSagaTestEngine(['PUT'])
const collectCalls = createSagaTestEngine(['CALL'])
const collectCallsAndPuts = createSagaTestEngine(['CALL', 'PUT'])

function sagaTestEngine(effects, genFunc, envMapping, ...initialArgs) {
  assert(
    isGeneratorFunction(genFunc),
    'The first parameter must be a generator function.')
  assert(
    isMap(envMapping) || isNestedArray(envMapping),
    'The second parameter must be a nested array or Map.')

  const mapping = [...envMapping, [undefined, undefined]]
  const gen = genFunc(...initialArgs)
  let val = undefined
  let collectedEffects = []
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
      (isFirstLoop || nextValFound || yieldedUndefined || yieldedEffectShouldBeCollected),
      `Env Mapping is missing a value for ${stringifyVal(val)}`)

    if (throwError) {
      genResult = gen.throw('ERROR')
    } else {
      genResult = gen.next(nextVal)
    }

    val = genResult.value
    isDone = genResult.done

    if (isEffect(val, effects) || isNestedEffect(val, effects)) {
      collectedEffects.push(val)
    }
    counter++
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
}
