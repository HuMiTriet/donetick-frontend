import type { Chrono } from 'chrono-node'

export type Highlight = {
  text: string
  start: number
  end: number
}

type ParseOutcome<T> = {
  result: T | null
  highlight?: Highlight[]
  cleanedSentence: string
}

type FrequencyPatternType =
  | 'day_of_the_month:every'
  | 'days_of_the_week:nth_occurrence'
  | 'days_of_the_week:nth_occurrence_multiple'
  | 'daily'
  | 'daily:time'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'interval:2week'
  | 'interval'
  | 'interval:every_other'
  | 'days_of_the_week'
  | 'day_of_the_month'

type FrequencyPattern = {
  frequencyType: FrequencyPatternType
  regex: RegExp
  name: string
  value?: number
}

type FrequencyMetadata = {
  days: string[]
  months: string[]
  unit: string | null
  time: string
  weekPattern?: string
  occurrences?: number[]
}

export type Frequency = {
  frequency: number
  frequencyType: string | null
  frequencyMetadata: FrequencyMetadata
}

type FrequencyParseOutcome = ParseOutcome<Frequency> & {
  name: string | null
  dueDate?: string
}

type PriorityParseOutcome = {
  result: string | 0
  highlight: Highlight[]
  cleanedSentence: string
}

type AssignableUser = {
  userId: number
  displayName?: string | undefined
}

type AssigneesParseOutcome<T> = ParseOutcome<T[]> & {
  isAnyone: boolean
}

const VALID_DAYS: Record<string, string> = {
  monday: 'Monday',
  mon: 'Monday',
  tuesday: 'Tuesday',
  tue: 'Tuesday',
  wednesday: 'Wednesday',
  wed: 'Wednesday',
  thursday: 'Thursday',
  thu: 'Thursday',
  friday: 'Friday',
  fri: 'Friday',
  saturday: 'Saturday',
  sat: 'Saturday',
  sunday: 'Sunday',
  sun: 'Sunday',
}

const VALID_MONTHS: Record<string, string> = {
  january: 'January',
  jan: 'January',
  february: 'February',
  feb: 'February',
  march: 'March',
  mar: 'March',
  april: 'April',
  apr: 'April',
  may: 'May',
  june: 'June',
  jun: 'June',
  july: 'July',
  jul: 'July',
  august: 'August',
  aug: 'August',
  september: 'September',
  sep: 'September',
  october: 'October',
  oct: 'October',
  november: 'November',
  nov: 'November',
  december: 'December',
  dec: 'December',
}

const FREQUENCY_PATTERNS: FrequencyPattern[] = [
  {
    frequencyType: 'day_of_the_month:every',
    regex: /(\d+)(?:th|st|nd|rd)? of every month/i,
    name: 'Every {day} of every month',
  },
  {
    frequencyType: 'days_of_the_week:nth_occurrence',
    regex:
      /(first|second|third|fourth|last|\d+(?:st|nd|rd|th)?) (monday|tuesday|wednesday|thursday|friday|saturday|sunday) of (?:the )?month/i,
    name: '{occurrence} {day} of the month',
  },
  {
    frequencyType: 'days_of_the_week:nth_occurrence_multiple',
    regex:
      /((?:first|second|third|fourth|last|\d+(?:st|nd|rd|th)?)(?:,? (?:and |& )?))+\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s? of (?:the )?month/i,
    name: '{occurrences} {day} of the month',
  },
  {
    frequencyType: 'daily',
    regex: /(every day|daily|everyday)/i,
    name: 'Every day',
  },
  {
    frequencyType: 'daily:time',
    regex: /every (morning|noon|afternoon|evening|night)/i,
    name: 'Every {time} daily',
  },
  {
    frequencyType: 'weekly',
    regex: /(every week|weekly)/i,
    name: 'Every week',
  },
  {
    frequencyType: 'monthly',
    regex: /(every month|monthly)/i,
    name: 'Every month',
  },
  {
    frequencyType: 'yearly',
    regex: /every year/i,
    name: 'Every year',
  },
  {
    frequencyType: 'monthly',
    regex: /every (?:other )?month/i,
    name: 'Bi Monthly',
    value: 2,
  },
  {
    frequencyType: 'interval:2week',
    regex: /(bi-?weekly|every other week)/i,
    value: 2,
    name: 'Bi Weekly',
  },
  {
    frequencyType: 'interval',
    regex: /every (\d+) (days?|weeks?|months?|years?)/i,
    name: 'Every {frequency} {unit}',
  },
  {
    frequencyType: 'interval:every_other',
    regex: /every other (days?|weeks?|months?|years?)/i,
    name: 'Every other {unit}',
  },
  {
    frequencyType: 'days_of_the_week',
    regex: /every ([\w, ]+(?:day)?(?:, [\w, ]+(?:day)?)*)/i,
    name: 'Every {days}',
  },
  {
    frequencyType: 'day_of_the_month',
    regex: /(\d+)(?:st|nd|rd|th)? of ([\w ]+(?:(?:,| and |\s)[\w ]+)*)/i,
    name: 'Every {day} days of {months}',
  },
]

// Helper function to validate word boundaries for date/time matches
// Prevents matching partial words like 'wed' in 'wedding', 'fri' in 'friend', etc.
const isValidWordBoundary = (
  text: string,
  matchIndex: number,
  matchLength: number,
): boolean => {
  const charBefore = matchIndex > 0 ? text[matchIndex - 1] : ' '
  const charAfter =
    matchIndex + matchLength < text.length
      ? text[matchIndex + matchLength]
      : ' '
  // Valid boundaries: spaces, punctuation, but NOT alphanumeric or word-forming characters
  return !(
    /[\p{L}\p{N}_]/u.test(charBefore) || /[\p{L}\p{N}_]/u.test(charAfter)
  )
}

export const parsePriority = (inputSentence: string): PriorityParseOutcome => {
  let sentence = inputSentence.toLowerCase()
  const priorityMap: Record<number, string[]> = {
    1: ['!p1', 'priority 1', 'high priority', 'urgent', 'asap', 'important'],
    2: ['!p2', 'priority 2', 'medium priority'],
    3: ['!p3', 'priority 3', 'low priority'],
    4: ['!p4', 'priority 4'],
  }

  for (const [priority, terms] of Object.entries(priorityMap)) {
    if (terms.some(term => sentence.includes(term))) {
      return {
        result: priority,
        highlight: terms
          .map(term => {
            const index = sentence.indexOf(term)
            return {
              text: term,
              start: index,
              end: index + term.length,
            }
          })
          .filter(term => term.start !== -1),

        cleanedSentence: sentence.replace(
          new RegExp(`(${terms.join('|')})`, 'g'),
          '',
        ),
      }
    }
  }
  return {
    result: 0,
    highlight: [],
    cleanedSentence: inputSentence,
  }
}

export const parseLabels = <T extends { name: string }>(
  inputSentence: string,
  userLabels: T[],
): ParseOutcome<T[]> => {
  const currentLabels: T[] = []
  const matchedRanges: { start: number; end: number }[] = []
  const allHighlights: Highlight[] = []

  // Labels can contain spaces (e.g. "New Label"), so a plain word-boundary
  // regex can't capture them — check each '#' against real label names
  // instead, longest name first so "New Label" wins over a label named "New".
  const sortedLabels = [...userLabels].sort(
    (a, b) => b.name.length - a.name.length,
  )
  const isWordChar = (ch: string | undefined): boolean =>
    ch !== undefined && /[\p{L}\p{N}_]/u.test(ch)

  const hashPattern = /#/g
  let hashMatch: RegExpExecArray | null
  while ((hashMatch = hashPattern.exec(inputSentence)) !== null) {
    const startIndex = hashMatch.index
    const rest = inputSentence.slice(startIndex + 1)

    const existingLabel = sortedLabels.find(label => {
      const name = label.name
      if (rest.toLowerCase().slice(0, name.length) !== name.toLowerCase()) {
        return false
      }
      // Require a non-word boundary right after the name so "New" doesn't
      // match inside a longer typed word like "Newer".
      return !isWordChar(rest[name.length])
    })

    // Unmatched #mentions (no existing label, not created) are left as plain
    // text — only #mentions resolving to a real label are extracted/cleaned.
    if (!existingLabel) continue

    const fullMatch = `#${existingLabel.name}`
    currentLabels.push(existingLabel)
    matchedRanges.push({
      start: startIndex,
      end: startIndex + fullMatch.length,
    })
    allHighlights.push({
      text: inputSentence.slice(startIndex, startIndex + fullMatch.length),
      start: startIndex,
      end: startIndex + fullMatch.length,
    })
    hashPattern.lastIndex = startIndex + fullMatch.length
  }

  if (currentLabels.length > 0) {
    let cleanedSentence = inputSentence
    for (const range of matchedRanges
      .slice()
      .sort((a, b) => b.start - a.start)) {
      cleanedSentence =
        cleanedSentence.slice(0, range.start) + cleanedSentence.slice(range.end)
    }

    return {
      result: currentLabels,
      highlight: allHighlights,
      cleanedSentence: cleanedSentence.replace(/\s+/g, ' ').trim(),
    }
  }

  return {
    result: null,
    cleanedSentence: inputSentence,
  }
}

export const parseFrequency = (
  inputSentence: string,
): FrequencyParseOutcome => {
  const sentence = inputSentence.toLowerCase()
  const result: Frequency = {
    frequency: 1,
    frequencyType: null,
    frequencyMetadata: {
      days: [],
      months: [],
      unit: null,
      time: new Date().toISOString(),
    },
  }
  for (const pattern of FREQUENCY_PATTERNS) {
    const match = sentence.match(pattern.regex)
    if (!match) continue

    result.frequencyType = pattern.frequencyType
    const unitMap = {
      daily: 'days',
      weekly: 'weeks',
      monthly: 'months',
      yearly: 'years',
    }

    switch (pattern.frequencyType) {
      case 'daily':
      case 'weekly':
      case 'monthly':
      case 'yearly':
        result.frequencyType = 'interval'
        result.frequency = pattern.value ?? 1
        result.frequencyMetadata.unit = unitMap[pattern.frequencyType]
        return {
          result,
          name: pattern.name,
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }

      case 'interval':
        result.frequency = parseInt(match[1], 10)
        result.frequencyMetadata.unit = match[2]
        return {
          result,
          name: pattern.name
            .replace('{frequency}', String(result.frequency))
            .replace('{unit}', result.frequencyMetadata.unit),
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }

      case 'days_of_the_week':
        result.frequencyMetadata.days = match[1]
          .toLowerCase()
          .split(/ and |,|\s/)
          .map(day => day.trim())
          .filter(day => {
            // Validate that the day abbreviation is at proper word boundaries
            // This prevents matches like 'wed' in 'wedding', 'fri' in 'friend'
            if (!VALID_DAYS[day]) return false
            // For short abbreviations (3 chars or less), validate word boundaries
            if (day.length <= 3) {
              const dayIndex = sentence.toLowerCase().indexOf(day)
              if (dayIndex === -1) return false
              return isValidWordBoundary(
                sentence.toLowerCase(),
                dayIndex,
                day.length,
              )
            }
            return true
          })
          .map(day => VALID_DAYS[day])
        if (!result.frequencyMetadata.days.length)
          return { result: null, name: null, cleanedSentence: inputSentence }
        return {
          result,
          name: pattern.name.replace(
            '{days}',
            result.frequencyMetadata.days.join(', '),
          ),
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }

      case 'day_of_the_month':
        result.frequency = parseInt(match[1], 10)
        result.frequencyMetadata.months = match[2]
          .toLowerCase()
          .split(/ and |,|\s/)
          .map(month => month.trim())
          .filter(month => {
            if (!VALID_MONTHS[month]) return false
            // For short abbreviations (3 chars or less), validate word boundaries
            if (month.length <= 3) {
              const monthIndex = sentence.toLowerCase().indexOf(month)
              if (monthIndex === -1) return false
              return isValidWordBoundary(
                sentence.toLowerCase(),
                monthIndex,
                month.length,
              )
            }
            return true
          })
          .map(month => VALID_MONTHS[month])
        result.frequencyMetadata.unit = 'days'
        return {
          result,
          name: pattern.name
            .replace('{day}', String(result.frequency))
            .replace('{months}', result.frequencyMetadata.months.join(', ')),
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }
      case 'interval:2week':
        result.frequency = 2
        result.frequencyMetadata.unit = 'weeks'
        result.frequencyType = 'interval'
        return {
          result,
          name: pattern.name,
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }
      case 'daily:time':
        result.frequency = 1
        result.frequencyMetadata.unit = 'days'
        result.frequencyType = 'daily'
        return {
          result,
          name: pattern.name.replace('{time}', match[1]),
          // replace every x with ''
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }

      case 'day_of_the_month:every':
        const dayOfMonth = parseInt(match[1], 10)
        result.frequencyType = 'interval'
        result.frequency = 1
        result.frequencyMetadata.unit = 'months'

        // Calculate the next occurrence of this day of the month
        const todayEvery = new Date()
        let suggestedDueDate = new Date(
          todayEvery.getFullYear(),
          todayEvery.getMonth(),
          dayOfMonth,
          23,
          59,
          0,
        )
        if (suggestedDueDate <= todayEvery) {
          // Day has already passed this month, move to next month
          suggestedDueDate = new Date(
            todayEvery.getFullYear(),
            todayEvery.getMonth() + 1,
            dayOfMonth,
            23,
            59,
            0,
          )
        }

        return {
          result,
          name: pattern.name.replace('{day}', String(dayOfMonth)),
          dueDate: suggestedDueDate.toISOString(),
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }
      case 'interval:every_other':
        result.frequency = 2
        result.frequencyMetadata.unit = match[1]
        result.frequencyType = 'interval'
        return {
          result,
          name: pattern.name.replace('{unit}', result.frequencyMetadata.unit),
          highlight: [
            {
              text: pattern.name,
              start: sentence.indexOf(match[0]),
              end: sentence.indexOf(match[0]) + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }

      case 'days_of_the_week:nth_occurrence':
        const occurrenceText = match[1].toLowerCase()
        const dayName = match[2].toLowerCase()

        // Map occurrence words to numbers
        const occurrenceMap: Record<string, number> = {
          first: 1,
          '1st': 1,
          second: 2,
          '2nd': 2,
          third: 3,
          '3rd': 3,
          fourth: 4,
          '4th': 4,
          last: -1,
        }

        const occurrence =
          occurrenceMap[occurrenceText] ||
          parseInt(occurrenceText.replace(/\D/g, ''), 10)

        if (!VALID_DAYS[dayName]) {
          return { result: null, name: null, cleanedSentence: inputSentence }
        }

        result.frequencyType = 'days_of_the_week'
        result.frequencyMetadata.days = [VALID_DAYS[dayName].toLowerCase()]
        result.frequencyMetadata.weekPattern = 'week_of_month'
        result.frequencyMetadata.occurrences = [occurrence]

        const startIndex = inputSentence
          .toLowerCase()
          .indexOf(match[0].toLowerCase())
        return {
          result,
          name: pattern.name
            .replace('{occurrence}', match[1])
            .replace('{day}', VALID_DAYS[dayName]),
          highlight: [
            {
              text: inputSentence.substring(
                startIndex,
                startIndex + match[0].length,
              ),
              start: startIndex,
              end: startIndex + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }

      case 'days_of_the_week:nth_occurrence_multiple':
        const occurrencesText = match[1].toLowerCase()
        const dayName2 = match[2].toLowerCase()

        if (!VALID_DAYS[dayName2]) {
          return { result: null, name: null, cleanedSentence: inputSentence }
        }

        // Parse multiple occurrences like "first, second and third"
        const occurrences = occurrencesText
          .replace(/,?\s*(and|&)\s*/g, ' ')
          .split(/\s+/)
          .filter(word => word.trim())
          .map(word => {
            const cleanWord = word.replace(',', '').trim()
            const occurrenceMap: Record<string, number> = {
              first: 1,
              '1st': 1,
              second: 2,
              '2nd': 2,
              third: 3,
              '3rd': 3,
              fourth: 4,
              '4th': 4,
              last: -1,
            }
            return (
              occurrenceMap[cleanWord] ||
              parseInt(cleanWord.replace(/\D/g, ''), 10)
            )
          })
          .filter(num => !isNaN(num))

        result.frequencyType = 'days_of_the_week'
        result.frequencyMetadata.days = [VALID_DAYS[dayName2].toLowerCase()]
        result.frequencyMetadata.weekPattern = 'week_of_month'
        result.frequencyMetadata.occurrences = occurrences

        const startIndex2 = inputSentence
          .toLowerCase()
          .indexOf(match[0].toLowerCase())
        return {
          result,
          name: pattern.name
            .replace('{occurrences}', match[1])
            .replace('{day}', VALID_DAYS[dayName2]),
          highlight: [
            {
              text: inputSentence.substring(
                startIndex2,
                startIndex2 + match[0].length,
              ),
              start: startIndex2,
              end: startIndex2 + match[0].length,
            },
          ],
          cleanedSentence: inputSentence.replace(match[0], '').trim(),
        }
    }
  }
  return {
    result: null,
    name: null,
    highlight: [],
    cleanedSentence: inputSentence,
  }
}

export const parseAssignees = <T extends AssignableUser>(
  inputSentence: string,
  users: T[],
): AssigneesParseOutcome<T> => {
  const sentence = inputSentence.toLowerCase()
  const result: T[] = []
  const highlight: Highlight[] = []
  const matchedTexts: { pattern: string; original: string }[] = []

  // Check for @Anyone first (special case)
  const anyoneRegex = /@anyone(?=\s|$)/i
  const anyoneMatch = sentence.match(anyoneRegex)

  if (anyoneMatch) {
    const index = sentence.search(anyoneRegex)
    highlight.push({
      text: anyoneMatch[0],
      start: index,
      end: index + anyoneMatch[0].length,
    })
    matchedTexts.push({ pattern: '@anyone', original: anyoneMatch[0] })

    // For @Anyone, return empty result (no specific assignees)
    let cleanedSentence = sentence
    for (const matchedText of matchedTexts) {
      cleanedSentence = cleanedSentence.replace(
        new RegExp(
          matchedText.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'gi',
        ),
        '',
      )
    }

    return {
      result: [], // Empty assignees for @Anyone
      isAnyone: true, // Flag to indicate @Anyone was used
      highlight,
      cleanedSentence: cleanedSentence.replace(/\s+/g, ' ').trim(),
    }
  }

  // Sort users by longest displayName first to avoid partial matches
  const sortedUsers = users.sort(
    (a, b) => (b.displayName?.length ?? 0) - (a.displayName?.length ?? 0),
  )

  for (const user of sortedUsers) {
    if (!user.displayName) continue

    // Only match on display name - use word boundaries for exact matching
    const displayNamePattern = `@${user.displayName.toLowerCase()}`
    // Use word boundary or space/end to ensure exact match, not partial
    const exactMatchRegex = new RegExp(
      `@${user.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`,
      'i',
    )
    const exactMatch = sentence.match(exactMatchRegex)

    if (exactMatch && !result.some(r => r.userId === user.userId)) {
      result.push(user)
      const index = sentence.search(exactMatchRegex)

      highlight.push({
        text: exactMatch[0],
        start: index,
        end: index + exactMatch[0].length,
      })
      matchedTexts.push({
        pattern: displayNamePattern,
        original: exactMatch[0],
      })
    }
  }

  if (result.length > 0) {
    let cleanedSentence = sentence
    // Remove all matched assignee patterns using the original matched text
    for (const matchedText of matchedTexts) {
      cleanedSentence = cleanedSentence.replace(
        new RegExp(
          matchedText.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'gi',
        ),
        '',
      )
    }

    return {
      result,
      isAnyone: false,
      highlight,
      cleanedSentence: cleanedSentence.replace(/\s+/g, ' ').trim(),
    }
  }

  return { result: null, isAnyone: false, cleanedSentence: sentence }
}

export const parsePoints = (inputSentence: string): ParseOutcome<number> => {
  let sentence = inputSentence.toLowerCase()
  const pointsPattern = /\*(\d+)\s*(?:points?)?/gi
  const match = sentence.match(pointsPattern)

  if (!match) {
    return {
      result: null,
      highlight: [],
      cleanedSentence: inputSentence,
    }
  }

  // Extract the first points match
  const pointsMatch = match[0]
  const pointsValue = parseInt(pointsMatch.replace(/\D/g, ''), 10)
  const startIndex = inputSentence
    .toLowerCase()
    .indexOf(pointsMatch.toLowerCase())

  return {
    result: pointsValue,
    highlight: [
      {
        text: pointsMatch,
        start: startIndex,
        end: startIndex + pointsMatch.length,
      },
    ],
    cleanedSentence: inputSentence
      .replace(
        new RegExp(pointsMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '',
      )
      .replace(/\s+/g, ' ')
      .trim(),
  }
}

// Smallest stake Beeminder will charge, in cents ($1.00).
export const MIN_STAKE_CENTS = 100

// `$5` or `$5.50`: a dollar sign, up to six whole dollars, optionally a
// decimal point and one or two cent digits, standing on its own as a word.
const STAKE_PATTERN = /(^|\s)\$(\d{1,6}(?:\.\d{1,2})?)(?=\s|$)/

const matchStakeToken = (
  sentence: string,
): { start: number; end: number; cents: number } | null => {
  const match = STAKE_PATTERN.exec(sentence)
  if (!match) return null
  const [whole, leading, amount] = match
  const [dollars, cents = ''] = amount.split('.')
  return {
    start: match.index + leading.length,
    end: match.index + whole.length,
    cents: parseInt(dollars, 10) * 100 + parseInt(cents.padEnd(2, '0'), 10),
  }
}

// parseStake finds a Beeminder stake amount such as `$5` or `$5.50` and
// returns it in cents. Amounts below Beeminder's $1.00 minimum are ignored.
// The caller decides whether the stake applies (it needs a due date).
export const parseStake = (inputSentence: string): ParseOutcome<number> => {
  const token = matchStakeToken(inputSentence)
  if (!token || token.cents < MIN_STAKE_CENTS) {
    return { result: null, highlight: [], cleanedSentence: inputSentence }
  }
  const { end, start } = token
  return {
    result: token.cents,
    highlight: [{ text: inputSentence.slice(start, end), start, end }],
    cleanedSentence: (inputSentence.slice(0, start) + inputSentence.slice(end))
      .replace(/\s+/g, ' ')
      .trim(),
  }
}

// maskRange overwrites sentence[start:end] with `fill`, keeping the length, so
// another parser can't read that text while character positions stay put.
export const maskRange = (
  sentence: string,
  start: number,
  end: number,
  fill = ' ',
): string =>
  sentence.slice(0, start) + fill.repeat(end - start) + sentence.slice(end)

// A private-use character no parser reads as a letter, digit or date.
const STAKE_PLACEHOLDER = '\uE000'

export const parseDueDate = (
  inputSentence: string,
  chrono: Pick<Chrono, 'parse'>,
): ParseOutcome<Date> => {
  // Parse the due date using chrono
  const parsedDueDate = chrono.parse(inputSentence, new Date(), {
    forwardDate: true,
  })

  if (!parsedDueDate.length) {
    return {
      result: null,
      highlight: [],
      cleanedSentence: inputSentence,
    }
  }

  // Select the first valid word-bounded date match
  // Prevents false positives like "wed" in "wedding" while still allowing later valid matches
  const dueDateMatch = parsedDueDate.find(
    match =>
      match.index !== -1 &&
      isValidWordBoundary(inputSentence, match.index, match.text.length),
  )

  if (!dueDateMatch) {
    return {
      result: null,
      highlight: [],
      cleanedSentence: inputSentence,
    }
  }
  const dueDateText = dueDateMatch.text
  const dueDateStartIndex = dueDateMatch.index
  const dueDateEndIndex = dueDateStartIndex + dueDateText.length

  // Define words that might precede the due date and should be removed
  const precedingWords = [
    'starting',
    'from',
    'beginning',
    'begin',
    'commence',
    'commencing',
  ]

  // Look for preceding words before the due date
  let cleanStartIndex = dueDateStartIndex
  let highlightStartIndex = dueDateStartIndex
  let precedingWord = ''

  // Extract text before the due date to check for preceding words
  const textBeforeDueDate = inputSentence.substring(0, dueDateStartIndex).trim()

  for (const word of precedingWords) {
    // Check if the text before due date ends with this preceding word
    const wordPattern = new RegExp(`\\b${word}\\s*$`, 'i')
    const match = textBeforeDueDate.match(wordPattern)

    if (match) {
      // Found a preceding word, include it in the text to be removed
      const matchStart = textBeforeDueDate.length - match[0].length
      cleanStartIndex = matchStart
      highlightStartIndex = matchStart
      precedingWord = match[0].trim()
      break
    }
  }

  // Create the highlight text
  const fullHighlightText = precedingWord
    ? `${precedingWord} ${dueDateText}`
    : dueDateText

  // Create cleaned sentence by removing the full match (preceding word + due date)
  const textToRemove = inputSentence.substring(cleanStartIndex, dueDateEndIndex)
  const cleanedSentence = inputSentence
    .replace(textToRemove, '')
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()

  // If no specific time was mentioned, set to end of day (23:59:59)
  // to indicate the date has no specific time tied to it (same convention as ChoreEdit)
  let resultDate = dueDateMatch.start.date()
  if (!dueDateMatch.start.isCertain('hour')) {
    resultDate = new Date(resultDate)
    resultDate.setHours(23, 59, 59, 0)
  }

  return {
    result: resultDate,
    highlight: [
      {
        text: fullHighlightText,
        start: highlightStartIndex,
        end: dueDateEndIndex,
      },
    ],
    cleanedSentence: cleanedSentence,
  }
}

// parseDueDateAroundStake is parseDueDate with any `$amount` token hidden, so
// chrono can't read `$5.50 friday` as Friday at 5:50. Highlight positions
// refer to the original sentence, and the token is put back into
// cleanedSentence (the caller removes it if the stake applies).
export const parseDueDateAroundStake = (
  inputSentence: string,
  chrono: Pick<Chrono, 'parse'>,
): ParseOutcome<Date> => {
  const token = matchStakeToken(inputSentence)
  if (!token) return parseDueDate(inputSentence, chrono)
  const { end, start } = token
  const original = inputSentence.slice(start, end)
  const placeholder = STAKE_PLACEHOLDER.repeat(original.length)
  const outcome = parseDueDate(
    maskRange(inputSentence, start, end, STAKE_PLACEHOLDER),
    chrono,
  )
  return {
    ...outcome,
    cleanedSentence: outcome.cleanedSentence.replace(placeholder, original),
  }
}
