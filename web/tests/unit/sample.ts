import type { PatternDoc } from '../../src/types'
import data from '../fixtures/back-yoke.json'

/** The back yoke extracted from the fixture PDF. */
export const sample = data as unknown as PatternDoc
export const backYoke = sample.charts[0]
