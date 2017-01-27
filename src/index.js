'use strict'
const deepEqual = require('deep-equal')


const bool = o => !!o

const isPut = obj => bool(obj && Object.keys(obj).includes('PUT'))

const isNestedArray = arr => bool(
  arr &&
  arr.every && // Is an array
  arr.every(subArr => subArr.length === 2) // Every array inside has exactly 2 elements.
)

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
  return (mapping.find(keyVal => deepEqual(keyVal[0], searchVal)) || [])[1]
}

function runGenfunc(genFunc, envMapping, ...initialArgs) {
  if (typeof genFunc !== 'function') {
    console.error(`The first parameter must be a generator function.`)
  }

  if (!isNestedArray(envMapping)) {
    console.error(`The second parameter must be a nested array.`)
  }

  const mapping = [...envMapping, [undefined, undefined]]
  const gen = genFunc(...initialArgs)
  let val, genResult, nextVal
  let puts = []
  let isDone = false

  while (!isDone) {
    nextVal = getNextVal(val, mapping)

    // TODO: Should warn the user if yielded value is not found in the `mapping`.
    // if (nextVal === undefined) {
    //   console.warn(`
    //     Either the yielded value is not found in your Map, or`)
    // }

    genResult = gen.next(nextVal)

    val = genResult.value
    isDone = genResult.done

    if (isPut(val)) {
      puts.push(val)
    }
  }
  return puts
}

module.exports = { runGenfunc, isPut, isNestedArray, getNextVal, assert }
