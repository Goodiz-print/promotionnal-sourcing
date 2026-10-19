import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'

const run = promisify(execFile)

/** Binaire Ghostscript appelé en processus enfant, sans passer par un shell. */
const GHOSTSCRIPT_BINARY = 'gs'

/**
 * Implémentation réelle : `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook`, avec des
 * fichiers temporaires supprimés dans tous les cas.
 */
export default class ProcessGhostscriptRunner extends GhostscriptRunner {
  async available(): Promise<boolean> {
    try {
      await run(GHOSTSCRIPT_BINARY, ['--version'])
      return true
    } catch {
      return false
    }
  }

  async compress(content: Buffer): Promise<Buffer> {
    const directory = await mkdtemp(join(tmpdir(), 'pdf-'))
    const input = join(directory, 'input.pdf')
    const output = join(directory, 'output.pdf')
    try {
      await writeFile(input, content)
      await run(GHOSTSCRIPT_BINARY, [
        '-sDEVICE=pdfwrite',
        '-dPDFSETTINGS=/ebook',
        '-dNOPAUSE',
        '-dBATCH',
        '-dQUIET',
        `-sOutputFile=${output}`,
        input,
      ])
      return await readFile(output)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
}
