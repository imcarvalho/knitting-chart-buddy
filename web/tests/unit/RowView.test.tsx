import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RowView } from '../../src/components/RowView'
import { loadProgress, saveProgress } from '../../src/state/storage'
import { backYoke as chart, sample } from './sample'

const HASH = sample.source.sha256

function renderView() {
  return render(<RowView doc={sample} chart={chart} patternHash={HASH} reducedMotion />)
}

const instruction = () => screen.getByTestId('instruction')
const heading = () => screen.getByRole('heading', { level: 2 })

describe('RowView', () => {
  it('shows row 1 on the WS, worked left to right, starting with the first group', () => {
    renderView()
    expect(heading()).toHaveTextContent('Back yoke: row 1')
    expect(screen.getByText('WS')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Work left to right' })).toBeInTheDocument()
    expect(instruction()).toHaveTextContent('Purl 2')
    expect(screen.getByTestId('next-preview')).toHaveTextContent('Next: Knit 2')
  })

  it('announces each step through a short polite live region, with the row when it changes', async () => {
    const user = userEvent.setup()
    renderView()
    const announcer = screen.getByTestId('announcer')
    expect(announcer).toHaveAttribute('aria-live', 'polite')
    expect(announcer).toHaveTextContent('Row 1, wrong side, left to right. Purl 2. Group 1 of 11.')
    // The card itself is not live: it would read everything again on every step.
    expect(instruction()).not.toHaveAttribute('aria-live')
    await user.keyboard(' ')
    expect(announcer).toHaveTextContent(/^Knit 2\. Group 2 of 11\.$/)
    await user.keyboard('{ArrowDown}')
    expect(announcer).toHaveTextContent('Row 2, right side, right to left. Work the double stitch. Group 1 of 15.')
  })

  it('makes two identical groups in a row sound different', async () => {
    const user = userEvent.setup()
    saveProgress({ patternHash: HASH, chartId: chart.id, row: 2, groupIndex: 2 })
    renderView()
    const announcer = screen.getByTestId('announcer')
    await user.keyboard(' ')
    const first = announcer.textContent
    await user.keyboard(' ')
    expect(announcer.textContent).not.toBe(first)
  })

  it('moves focus to the row heading when a chart opens', () => {
    renderView()
    expect(heading()).toHaveFocus()
  })

  it('lets Space activate a focused button instead of stepping', async () => {
    const user = userEvent.setup()
    renderView()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(heading()).toHaveTextContent('row 3')
    screen.getByRole('button', { name: 'Undo' }).focus()
    await user.keyboard(' ')
    expect(heading()).toHaveTextContent('row 2')
    expect(instruction()).toHaveTextContent('Row 2, group 1 of')
  })

  it('names the controls and the chart for screen readers', () => {
    renderView()
    expect(screen.getByRole('button', { name: 'Back one group' })).toHaveTextContent('Back')
    expect(screen.getByRole('button', { name: 'Next group' })).toHaveTextContent('Next')
    const region = screen.getByRole('region', { name: /^Chart/ })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(screen.getByText('wrong side.')).toBeInTheDocument()
    expect(document.title).toBe('Back yoke, row 1 - Knitting Chart Buddy')
  })

  it('highlights the current group in the strip', () => {
    renderView()
    expect(screen.getByTestId('highlight')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /current group on columns 30, 29/ })).toBeInTheDocument()
  })

  it('steps with the keyboard: Space, arrows, Page Up/Down, Backspace', async () => {
    const user = userEvent.setup()
    renderView()
    await user.keyboard(' ')
    expect(instruction()).toHaveTextContent('Knit 2')
    await user.keyboard('{PageDown}')
    expect(instruction()).toHaveTextContent('Purl 2')
    await user.keyboard('{ArrowRight}')
    expect(instruction()).toHaveTextContent('Knit 3')
    await user.keyboard('{Backspace}')
    expect(instruction()).toHaveTextContent('Purl 2')
    await user.keyboard('{PageUp}{ArrowLeft}')
    expect(instruction()).toHaveTextContent('Row 1, group 1 of')
  })

  it('moves rows with the up and down arrows', async () => {
    const user = userEvent.setup()
    renderView()
    await user.keyboard('{ArrowDown}')
    expect(heading()).toHaveTextContent('row 2')
    expect(screen.getByText('RS')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Work right to left' })).toBeInTheDocument()
    expect(instruction()).toHaveTextContent('Work the double stitch')
    await user.keyboard('{ArrowUp}')
    expect(heading()).toHaveTextContent('row 1')
  })

  it('shows a cable with the needle count, FRONT/BACK and steps', async () => {
    const user = userEvent.setup()
    saveProgress({ patternHash: HASH, chartId: chart.id, row: 2, groupIndex: 5 })
    renderView()
    const card = within(instruction())
    expect(card.getByText('2/1 Left front cable (purl behind st)')).toBeInTheDocument()
    expect(card.getByText('BACK')).toBeInTheDocument()
    expect(card.getByText(/on cable needle/)).toHaveTextContent('1 st on cable needle')
    expect(card.getByText('Slip 1 st to cable needle, hold at the BACK, knit 2, purl 1 from cable needle')).toBeInTheDocument()
    // The short form is visible but hidden from screen readers, which read the full sentence.
    const steps = card.getAllByRole('listitem', { hidden: true })
    expect(steps.map((li) => li.textContent)).toEqual(['sl1 to cn, BACK', 'k2', 'p1 from cn'])
    expect(steps[0].closest('ol')).toHaveAttribute('aria-hidden', 'true')

    await user.keyboard(' ')
    expect(card.getByText('FRONT')).toBeInTheDocument()
    expect(card.getByText(/on cable needle/)).toHaveTextContent('2 sts on cable needle')
  })

  it('jumps to a row with g then a number', async () => {
    const user = userEvent.setup()
    renderView()
    await user.keyboard('g')
    expect(screen.getByLabelText('Row')).toHaveFocus()
    await user.keyboard('40{Enter}')
    expect(heading()).toHaveTextContent('row 40')
  })

  it('undoes a mistaken step', async () => {
    const user = userEvent.setup()
    renderView()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(heading()).toHaveTextContent('row 3')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(heading()).toHaveTextContent('row 2')
  })

  it('advances on a tap on the right half and goes back on the left half', () => {
    renderView()
    const area = screen.getByTestId('tap-area')
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(area, { clientX: 300, clientY: 50 })
    fireEvent.pointerUp(area, { clientX: 300, clientY: 50 })
    expect(instruction()).toHaveTextContent('Knit 2')
    fireEvent.pointerDown(area, { clientX: 100, clientY: 50 })
    fireEvent.pointerUp(area, { clientX: 100, clientY: 50 })
    expect(instruction()).toHaveTextContent('Purl 2')
    fireEvent.pointerDown(area, { clientX: 200, clientY: 150 })
    fireEvent.pointerUp(area, { clientX: 205, clientY: 40 }) // swipe up
    expect(heading()).toHaveTextContent('row 2')
  })

  it('saves progress after every step', async () => {
    const user = userEvent.setup()
    renderView()
    await user.keyboard('   ')
    expect(loadProgress(HASH, chart.id)).toMatchObject({ row: 1, groupIndex: 3 })
  })

  it('shows the edge note and the size range', () => {
    renderView()
    expect(screen.getByText(/Plus edge stitches, not charted/)).toBeInTheDocument()
    expect(screen.getByText('Size 3: rows 1 to 77')).toBeInTheDocument()
  })
})
