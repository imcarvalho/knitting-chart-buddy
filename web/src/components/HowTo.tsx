import * as s from './HowTo.css'

/** How to use the app, shown on the open screen and from the Help button. */
export function HowTo() {
  return (
    <section className={s.howTo} aria-labelledby="how-to-title">
      <h2 id="how-to-title">How to use it</h2>
      <ol className={s.steps}>
        <li>
          <strong>Make a PDF of the chart page only.</strong> One page, with one chart on it. In your PDF viewer, print
          or export just that page as a new PDF (on a Mac, in Preview: File, Print, choose that page, then Save as PDF).
        </li>
        <li>
          <strong>The PDF must come from the designer&apos;s file, not a scan.</strong> The app reads the lines and
          numbers drawn in the PDF. A scan, a photo or a screenshot saved as PDF is only a picture and will not work. A
          quick test: zoom right in on the chart. If the lines stay sharp and you can select the row numbers as text, it
          will work.
        </li>
        <li>
          <strong>Open the PDF in the app.</strong> On the start screen, drop it on the box or choose it. It is read on
          your device and never uploaded anywhere. Then give the chart a name, pick your size, and start knitting.
        </li>
        <li>
          <strong>Follow one group of stitches at a time.</strong> The arrow shows which way to read the row. For each
          cable you get how many stitches go on the cable needle, and whether to hold it in front or at the back.
        </li>
        <li>
          <strong>Your place is saved.</strong> Close the page and come back later: the chart reopens on the same row
          and stitch group, on this device.
        </li>
      </ol>
      <p>
        For now the app knows the symbols of the Shanon Sweater by @hongttoknit. A chart that uses other symbols stops
        with a message saying which row and column it could not read.
      </p>
      <p className={s.keys}>
        Keys: Space, → or Page Down for the next group. Backspace, ← or Page Up to go back. ↑ ↓ for rows. g to go to a
        row. u to undo. On a phone or tablet, tap the right or left half of the instruction, or swipe up or down for
        rows. A Bluetooth page turner works too.
      </p>
    </section>
  )
}
