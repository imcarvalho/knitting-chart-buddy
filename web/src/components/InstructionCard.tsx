import type { Group, PatternDoc } from '../types'
import { GlyphCard } from './ChartStrip'
import * as s from './InstructionCard.css'

interface Props {
  doc: PatternDoc
  group: Group | undefined
  rowNumber: number
  groupIndex: number
  groupCount: number
}

/** The current group's instruction. Screen readers hear each step through RowView's announcer. */
export function InstructionCard({ doc, group, rowNumber, groupIndex, groupCount }: Props) {
  return (
    <section className={s.card} aria-label="Current instruction" data-testid="instruction">
      {group ? (
        <>
          <p className={s.position} data-testid="instruction-pos">
            Row {rowNumber}, group {groupIndex + 1} of {groupCount}
          </p>
          {group.kind === 'cable' && group.cn && group.steps ? (
            <CableDetail doc={doc} group={group} />
          ) : (
            <p className={s.text}>{group.text}</p>
          )}
        </>
      ) : (
        <p className={s.text}>Nothing to work on this row.</p>
      )}
    </section>
  )
}

function CableDetail({ doc, group }: { doc: PatternDoc; group: Group }) {
  const cn = group.cn!
  const holdFront = cn.hold === 'front'
  return (
    <div>
      <p className={s.cableName}>{group.legend}</p>
      <div className={s.cableMain}>
        {group.symbol && <GlyphCard doc={doc} symbolId={group.symbol} />}
        <div>
          <p className={s.cableFact}>
            <span className={s.cableCount}>{cn.count}</span> st{cn.count > 1 ? 's' : ''} on cable needle
          </p>
          <p className={s.cableFact}>
            Hold {holdFront ? 'in' : 'at the'} <strong className={s.holdWord[cn.hold]}>{holdFront ? 'FRONT' : 'BACK'}</strong>
          </p>
        </div>
      </div>
      <p className={s.cableText}>{group.text}</p>
      {/* Short form of the sentence above: hidden from screen readers, which read the sentence. */}
      <ol className={s.steps} aria-hidden="true">
        <li>
          sl{cn.count} to cn, {holdFront ? 'FRONT' : 'BACK'}
        </li>
        {group.steps!.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  )
}
