import { expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PDF = fileURLToPath(new URL('../../../fixtures/Shanon_Sweater_tamanho3-back.pdf', import.meta.url))

// The pattern PDF is not in the repository: this runs only where a copy is in fixtures/.
test.skip(!existsSync(PDF), 'needs fixtures/Shanon_Sweater_tamanho3-back.pdf')

test('reads a chart PDF in the browser and starts knitting it', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles(PDF)

  await expect(page.getByRole('heading', { name: 'Chart read' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('79 rows, worked flat')).toBeVisible()
  await expect(page.getByLabel('Chart name')).toHaveValue('Back yoke')
  await expect(page.getByLabel('Size')).toHaveValue('3')
  await page.getByRole('button', { name: 'Start knitting' }).click()

  const heading = page.getByRole('heading', { level: 2 })
  await expect(heading).toHaveText('Back yoke: row 1')
  await expect(page.getByTestId('instruction')).toContainText('Purl 2')
  await expect(page.getByText('Size 3: rows 1 to 77')).toBeVisible()

  await page.keyboard.press('ArrowDown')
  for (let i = 0; i < 5; i++) await page.keyboard.press('Space')
  await expect(page.getByTestId('instruction')).toContainText(
    'Slip 1 st to cable needle, hold at the BACK, knit 2, purl 1 from cable needle',
  )

  // The extracted chart and the position are kept on the device.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('kcb:recent'))).not.toBeNull()
  await page.reload()
  await expect(heading).toHaveText('Back yoke: row 2')
  await expect(page.getByTestId('instruction')).toContainText('Row 2, group 6 of 15')
})

test('explains why a PDF cannot be read', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('file-input').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') })
  await expect(page.getByRole('alert')).toContainText('cannot read this PDF')
})
