/** A problem with the input that must not be guessed around. */
export class ExtractionError extends Error {
  constructor(message: string, where: { row?: number | null; col?: number | null } = {}) {
    const parts = ['page 1']
    if (where.row !== undefined && where.row !== null) parts.push(`row ${where.row}`)
    if (where.col !== undefined && where.col !== null) parts.push(`column ${where.col}`)
    super(`${parts.join(', ')}: ${message}`)
    this.name = 'ExtractionError'
  }
}
