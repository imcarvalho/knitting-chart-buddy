import type { Group, PatternDoc } from '../types'
import { GlyphCard } from './ChartStrip'

interface Props {
  doc: PatternDoc
  group: Group | undefined
  rowNumber: number
  groupIndex: number
  groupCount: number
}

/** The current group's instruction. A polite live region, so each new group is announced. */
export function InstructionCard({ doc, group, rowNumber, groupIndex, groupCount }: Props) {
  return (
    <section className="instruction" aria-live="polite" aria-atomic="true" data-testid="instruction">
      {group ? (
        <>
          <p className="instruction-pos">
            Row {rowNumber}, group {groupIndex + 1} of {groupCount}
          </p>
          {group.kind === 'cable' && group.cn && group.steps ? (
            <CableDetail doc={doc} group={group} />
          ) : (
            <p className={`instruction-text kind-${group.kind}`}>{group.text}</p>
          )}
        </>
      ) : (
        <p className="instruction-text">Nothing to work on this row.</p>
      )}
    </section>
  )
}

function CableDetail({ doc, group }: { doc: PatternDoc; group: Group }) {
  const cn = group.cn!
  const holdFront = cn.hold === 'front'
  return (
    <div className="cable">
      <p className="cable-name">{group.legend}</p>
      <div className="cable-main">
        {group.symbol && <GlyphCard doc={doc} symbolId={group.symbol} />}
        <div className="cable-facts">
          <p className="cable-cn">
            <span className="big">{cn.count}</span> st{cn.count > 1 ? 's' : ''} on cable needle
          </p>
          <p className={`cable-hold ${holdFront ? 'front' : 'back'}`}>
            Hold {holdFront ? 'in' : 'at the'} <strong>{holdFront ? 'FRONT' : 'BACK'}</strong>
          </p>
        </div>
      </div>
      <p className="instruction-text">{group.text}</p>
      <ol className="cable-steps" aria-label="Steps">
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
