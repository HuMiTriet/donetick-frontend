// Run with: node --test tests/stakes.test.mjs
// Node strips TypeScript types itself, so these import the real sources.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as chrono from 'chrono-node'

import {
  getStakeState,
  nextStakeChangeAt,
  stakeRankBoost,
  timeLeftParts,
} from '../src/utils/stakes.ts'
import {
  maskRange,
  parseDueDateAroundStake,
  parseStake,
} from '../src/views/components/CustomParsers.ts'

describe('parseStake', () => {
  it('reads whole dollars and dollars with cents', () => {
    assert.equal(parseStake('gym $5 tomorrow').result, 500)
    assert.equal(parseStake('gym $5.50 tomorrow').result, 550)
    assert.equal(parseStake('gym $5.5 tomorrow').result, 550)
    assert.equal(parseStake('$12').result, 1200)
  })

  it('highlights the token and removes it from the title', () => {
    const outcome = parseStake('pay rent $5.50 tomorrow')
    assert.deepEqual(outcome.highlight, [{ text: '$5.50', start: 9, end: 14 }])
    assert.equal(outcome.cleanedSentence, 'pay rent tomorrow')
  })

  it('ignores amounts below the $1.00 Beeminder minimum', () => {
    assert.equal(parseStake('gym $0.50').result, null)
    assert.equal(parseStake('gym $0').result, null)
    assert.equal(parseStake('gym $1').result, 100)
  })

  it('ignores things that are not a standalone amount', () => {
    assert.equal(parseStake('gym $5.505').result, null)
    assert.equal(parseStake('a$5 thing').result, null)
    assert.equal(parseStake('gym $5abc').result, null)
    assert.equal(parseStake('gym $').result, null)
    assert.equal(parseStake('gym 5').result, null)
  })
})

describe('parseDueDateAroundStake', () => {
  it('keeps the stake digits away from the date parser', () => {
    const reference = chrono.parse('gym 5.50 friday', new Date(), {
      forwardDate: true,
    })
    // Without the mask, chrono reads the digits as a time.
    assert.ok(reference[0].text.includes('5.50'))

    const outcome = parseDueDateAroundStake('gym $5.50 friday', chrono)
    assert.ok(outcome.result instanceof Date)
    assert.equal(outcome.result.getDay(), 5)
    assert.equal(outcome.result.getHours(), 23, 'no time given: end of day')
    assert.equal(outcome.highlight[0].text, 'friday')
    assert.equal(outcome.highlight[0].start, 10)
    assert.equal(outcome.cleanedSentence, 'gym $5.50')
  })

  it('behaves like the plain parser without a stake', () => {
    const outcome = parseDueDateAroundStake('gym friday', chrono)
    assert.equal(outcome.result.getDay(), 5)
    assert.equal(outcome.cleanedSentence, 'gym')
  })

  it('finds no date in a stake alone', () => {
    assert.equal(parseDueDateAroundStake('gym $5', chrono).result, null)
  })
})

describe('maskRange', () => {
  it('keeps the length and the text around the range', () => {
    assert.equal(maskRange('ab$5cd', 2, 4), 'ab  cd')
    assert.equal(maskRange('ab$5cd', 2, 4, '*'), 'ab**cd')
  })
})

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0)
const staked = (hoursLeft, extra = {}) => ({
  priority: 0,
  status: 0,
  nextDueDate: new Date(NOW + hoursLeft * HOUR).toISOString(),
  stake: {
    amountCents: 500,
    editableUntil: new Date(NOW - HOUR).toISOString(),
  },
  ...extra,
})
// Mirrors ChoreSorter's priority comparison: index minus the stake boost.
const PRIORITY_ORDER = [1, 2, 3, 4, 0]
const effectiveRank = chore =>
  PRIORITY_ORDER.indexOf(chore.priority) - stakeRankBoost(chore, NOW)

describe('getStakeState', () => {
  it('is null without a stake', () => {
    assert.equal(getStakeState({ nextDueDate: null }, NOW), null)
    assert.equal(getStakeState({ stake: null }, NOW), null)
  })

  it('locks when the edit window closes', () => {
    const open = staked(48, {
      stake: {
        amountCents: 500,
        editableUntil: new Date(NOW + 60_000).toISOString(),
      },
    })
    assert.equal(getStakeState(open, NOW).locked, false)
    assert.equal(getStakeState(open, NOW + 60_000).locked, true)
  })

  it('treats a stake without editableUntil as unlocked', () => {
    assert.equal(
      getStakeState(staked(48, { stake: { amountCents: 500 } }), NOW).locked,
      false,
    )
  })

  it('steps through levels at 24h and 6h left, and overdue', () => {
    assert.equal(getStakeState(staked(25), NOW).level, 'staked')
    assert.equal(getStakeState(staked(24), NOW).level, 'urgent')
    assert.equal(getStakeState(staked(7), NOW).level, 'urgent')
    assert.equal(getStakeState(staked(6), NOW).level, 'critical')
    const late = getStakeState(staked(-30), NOW)
    assert.equal(late.level, 'critical')
    assert.equal(late.overdue, true)
    assert.equal(late.urgency, 1)
  })
})

describe('stakeRankBoost', () => {
  it('matches the boost table', () => {
    const cases = [
      [100, 0.5],
      [72, 0.5],
      [48, 0.94],
      [24, 2.28],
      [12, 3.28],
      [6, 3.86],
      [0, 4.5],
      [-5, 4.5],
    ]
    for (const [hours, boost] of cases) {
      assert.equal(
        Math.round(stakeRankBoost(staked(hours), NOW) * 100) / 100,
        boost,
        `${hours}h`,
      )
    }
  })

  it('is zero for unstaked chores', () => {
    assert.equal(stakeRankBoost({ priority: 1, nextDueDate: null }, NOW), 0)
  })

  it('always puts a staked chore above an unstaked one of the same priority', () => {
    for (const priority of [0, 1, 2, 3, 4]) {
      const plain = {
        priority,
        nextDueDate: new Date(NOW + HOUR).toISOString(),
      }
      assert.ok(
        effectiveRank(staked(500, { priority })) < effectiveRank(plain),
        `P${priority}`,
      )
    }
  })

  it('lifts an overdue staked no-priority chore above an unstaked P1', () => {
    assert.ok(effectiveRank(staked(-1)) < effectiveRank({ priority: 1 }))
  })

  it('climbs faster the closer the deadline', () => {
    const step = (from, to) =>
      stakeRankBoost(staked(to), NOW) - stakeRankBoost(staked(from), NOW)
    assert.ok(
      step(12, 6) > step(72, 66),
      'six hours near the end beat six hours far out',
    )
  })
})

describe('nextStakeChangeAt', () => {
  it('wakes at the window close, then the level boundaries', () => {
    const chore = staked(48, {
      stake: {
        amountCents: 500,
        editableUntil: new Date(NOW + 10 * 60_000).toISOString(),
      },
    })
    assert.equal(nextStakeChangeAt(chore, NOW), NOW + 10 * 60_000)
    assert.equal(nextStakeChangeAt(chore, NOW + 10 * 60_000), NOW + 24 * HOUR)
  })

  it('ticks every minute while a countdown shows, and stops once overdue', () => {
    assert.equal(nextStakeChangeAt(staked(10), NOW), NOW + 60_000)
    assert.equal(nextStakeChangeAt(staked(-1), NOW), null)
  })
})

describe('timeLeftParts', () => {
  it('uses the largest whole unit', () => {
    assert.deepEqual(timeLeftParts(30 * 60_000), { value: 30, unit: 'm' })
    assert.deepEqual(timeLeftParts(3 * HOUR + 1), { value: 3, unit: 'h' })
    assert.deepEqual(timeLeftParts(50 * HOUR), { value: 2, unit: 'd' })
  })
})
