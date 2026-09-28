import { describe, expect, it } from 'vitest'

import { geometricTextOrder, workdayTextOrder } from '../src/lib/textOrder'
import { TextRunSource } from '../src/lib/types'
import { RESUME_READING_ORDER } from './fixtures/resumeReadingOrder'

function source(nodeId: string, x: number, y: number): TextRunSource {
  return { nodeId, characters: nodeId, svg: '<svg/>', offset: { x, y }, segments: [] }
}

describe('geometricTextOrder', () => {
  it('orders rows top-to-bottom and an aligned row left-to-right without mutating paint order', () => {
    const paintOrder = [
      source('lower', 48, 240),
      source('right', 420, 100.4),
      source('left', 48, 100)
    ]

    expect(geometricTextOrder(paintOrder).map(({ nodeId }) => nodeId)).toEqual([
      'left',
      'right',
      'lower'
    ])
    expect(paintOrder.map(({ nodeId }) => nodeId)).toEqual(['lower', 'right', 'left'])
  })

  it('keeps the original order for nodes at the same coordinates', () => {
    const paintOrder = [source('first', 48, 100), source('second', 48, 100)]
    expect(geometricTextOrder(paintOrder).map(({ nodeId }) => nodeId)).toEqual(['first', 'second'])
  })

  it('fixes the supplied resume regression: Cloudflare is emitted before U.S. Bank', () => {
    const paintOrder = RESUME_READING_ORDER.map((item) => source(item.nodeId, item.x, item.top))
    expect(paintOrder.map(({ nodeId }) => nodeId)).toEqual(['us-bank', 'cloudflare'])
    expect(geometricTextOrder(paintOrder).map(({ nodeId }) => nodeId)).toEqual([
      'cloudflare',
      'us-bank'
    ])
  })
})

describe('workdayTextOrder', () => {
  it('emits title, employer, then dates without changing any source geometry', () => {
    const title = source('Director of Product Design', 48, 100)
    const dates = source('Dec 2020 – Oct 2021', 424, 100)
    const employer = source('U.S. Bank', 48, 121)
    const bullet = source('• Led the Partner Platforms organization.', 53, 151)
    const input = [bullet, employer, dates, title]
    const coordinates = new Map(input.map((item) => [item.nodeId, { ...item.offset }]))

    expect(workdayTextOrder(input).map(({ nodeId }) => nodeId)).toEqual([
      'Director of Product Design',
      'U.S. Bank',
      'Dec 2020 – Oct 2021',
      '• Led the Partner Platforms organization.'
    ])
    expect(input.map((item) => [item.nodeId, item.offset])).toEqual(
      input.map((item) => [item.nodeId, coordinates.get(item.nodeId)])
    )
  })

  it('does not mistake a bullet for an employer when a dated header has no company line', () => {
    const title = source('Director of Product Design', 48, 100)
    const dates = source('Dec 2020 - Oct 2021', 424, 100)
    const bullet = source('• Led the team', 53, 121)

    expect(workdayTextOrder([bullet, dates, title]).map(({ nodeId }) => nodeId)).toEqual([
      'Director of Product Design',
      'Dec 2020 - Oct 2021',
      '• Led the team'
    ])
  })
})
