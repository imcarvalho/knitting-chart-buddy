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

  it('announces the current group through a polite live region', () => {
    renderView()
    expect(instruction()).toHaveAttribute('aria-live', 'polite')
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
    expect(card.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['sl1 to cn, BACK', 'k2', 'p1 from cn'])

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
