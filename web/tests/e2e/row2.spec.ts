import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const SAMPLE = fileURLToPath(new URL('../fixtures/back-yoke.json', import.meta.url))

test('loads the back yoke JSON and steps through row 2', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles(SAMPLE)

  const heading = page.getByRole('heading', { level: 2 })
  const card = page.getByTestId('instruction')
  await expect(heading).toHaveText('Back yoke: row 1')
  await expect(card).toContainText('Purl 2')

  await page.keyboard.press('ArrowDown')
  await expect(heading).toHaveText('Back yoke: row 2')
  await expect(page.getByRole('img', { name: 'Work right to left' })).toBeVisible()

  const expected = [
    'Work the double stitch',
    'Knit 1',
    'Purl 2',
    'Knit 2',
    'Purl 2',
    'Slip 1 st to cable needle, hold at the BACK, knit 2, purl 1 from cable needle',
    'Slip 2 sts to cable needle, hold in FRONT, purl 1, knit 2 from cable needle',
  ]
  for (const [i, text] of expected.entries()) {
    if (i > 0) await page.keyboard.press('Space')
    await expect(card).toContainText(`Row 2, group ${i + 1} of`)
    await expect(card).toContainText(text)
  }
  await expect(card.getByText('FRONT', { exact: true })).toBeVisible()

  // Walk to the end of row 2: the next step lands on row 3.
  const total = Number((await card.locator('.instruction-pos').textContent())!.match(/of (\d+)$/)![1])
  expect(total).toBe(15)
  for (let i = expected.length; i < total; i++) await page.keyboard.press('PageDown')
  await expect(page.getByTestId('next-preview')).toContainText('turn, then row 3')
  await page.keyboard.press('Space')
  await expect(heading).toHaveText('Back yoke: row 3')

  // Progress survives a reload, once the chart itself is stored (it is listed as recent after that).
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kcb:recent'))).not.toBeNull()
  await page.reload()
  await expect(heading).toHaveText('Back yoke: row 3')
})
