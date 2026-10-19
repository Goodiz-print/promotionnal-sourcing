import { test } from '@japa/runner'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'
import PdfService from '#services/pdf_service'

/** Faux binaire : disponibilité et résultat de compression pilotés par le test. */
class FakeRunner extends GhostscriptRunner {
  constructor(
    private isAvailable: boolean,
    private output?: Buffer | Error
  ) {
    super()
  }

  async available(): Promise<boolean> {
    return this.isAvailable
  }

  async compress(): Promise<Buffer> {
    if (this.output instanceof Error) throw this.output
    return this.output ?? Buffer.alloc(0)
  }
}

const original = Buffer.alloc(1000, 'a')

test.group('PdfService — compression avec repli', () => {
  test('sans Ghostscript, le PDF original est gardé', async ({ assert }) => {
    const result = await new PdfService(new FakeRunner(false)).compress(original)

    assert.isFalse(result.compressed)
    assert.equal(result.content, original)
  })

  test('avec Ghostscript, un PDF plus léger est remplacé par sa version compressée', async ({
    assert,
  }) => {
    const smaller = Buffer.alloc(400, 'b')

    const result = await new PdfService(new FakeRunner(true, smaller)).compress(original)

    assert.isTrue(result.compressed)
    assert.equal(result.content, smaller)
  })

  test('une compression qui n’allège pas le fichier garde l’original', async ({ assert }) => {
    const bigger = Buffer.alloc(2000, 'c')

    const result = await new PdfService(new FakeRunner(true, bigger)).compress(original)

    assert.isFalse(result.compressed)
    assert.equal(result.content, original)
  })

  test('une sortie vide est traitée comme un échec', async ({ assert }) => {
    const result = await new PdfService(new FakeRunner(true, Buffer.alloc(0))).compress(original)

    assert.isFalse(result.compressed)
  })

  test('une erreur du binaire ne remonte jamais', async ({ assert }) => {
    const result = await new PdfService(new FakeRunner(true, new Error('gs a planté'))).compress(
      original
    )

    assert.isFalse(result.compressed)
    assert.equal(result.content, original)
  })
})
