import { randomUUID } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { observeRecognition } from '../src/modules/attendance/recognition-confirmation.js'

describe('Consecutive recognition evidence', () => {
  it('requires three distinct observations and ignores transport retries', () => {
    const event = randomUUID()
    expect(observeRecognition('pi',event,'1','A',100).count).toBe(1)
    expect(observeRecognition('pi',event,'1','A',101).count).toBe(1)
    expect(observeRecognition('pi',event,'2','A',102).ready).toBe(false)
    expect(observeRecognition('pi',event,'3','A',103).ready).toBe(true)
  })
  it('restarts on a different identity, UNKNOWN, new scope or timeout', () => {
    const event = randomUUID()
    observeRecognition('pi',event,'1','A',100)
    observeRecognition('pi',event,'2','A',101)
    expect(observeRecognition('pi',event,'3','B',102).count).toBe(1)
    expect(observeRecognition('pi',event,'4',null,103).count).toBe(0)
    expect(observeRecognition('pi',event,'5','B',104).count).toBe(1)
    expect(observeRecognition('pi',event+'new','6','B',105).count).toBe(1)
    expect(observeRecognition('pi',event,'7','B',30104).count).toBe(1)
  })
  it('does not let a delayed old identity reuse the new identity streak', () => {
    const event = randomUUID()
    observeRecognition('pi',event,'1','A',100)
    observeRecognition('pi',event,'2','B',101)
    expect(observeRecognition('pi',event,'1','A',102).count).toBe(0)
    expect(observeRecognition('pi',event,'3','B',103).count).toBe(2)
  })
})
