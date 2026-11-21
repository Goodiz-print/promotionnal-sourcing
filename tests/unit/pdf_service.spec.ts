import { test } from '@japa/runner'
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
  StandardFonts,
  type PDFPage,
} from 'pdf-lib'
import GhostscriptRunner from '#services/pdf/ghostscript_runner'
import { recipientLabel } from '#services/pdf/recipient_stamp'
import PdfService from '#services/pdf_service'
import { PDF_MAX_PAGE_SIZE, RECIPIENT_BANNER_HEIGHT } from '#shared/types/pdf'
import { encryptedPdf, realPdf, signedPdf } from '#tests/utils/pdf'

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

const stamp = { agencyName: 'Agence Lumière', rfqRef: '42' }
const service = () => new PdfService(new FakeRunner(false))

/** Contenu décodé des flux de la page (le texte `pdf-lib` y est en hexadécimal). */
function pageContent(page: PDFPage): string {
  const contents = page.node.Contents()
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents]
  return refs
    .map((ref) => page.doc.context.lookup(ref))
    .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
    .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'))
    .join('\n')
}

/** Un texte tel que `drawText` l'écrit avec la police standard. */
async function encoded(text: string): Promise<string> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  return font.encodeText(text).toString()
}

const encodedLabel = () => encoded(recipientLabel(stamp))

test.group('PdfService — version destinataire d’un devis (#238)', () => {
  test('un PDF simple reçoit un bandeau en tête de sa page, agrandie d’autant', async ({
    assert,
  }) => {
    const stamped = await service().stampRecipient(await realPdf(), stamp)

    const document = await PDFDocument.load(stamped)
    assert.equal(document.getPageCount(), 1)
    const page = document.getPage(0)
    assert.closeTo(page.getHeight(), 841.89 + RECIPIENT_BANNER_HEIGHT, 0.01)
    assert.closeTo(page.getCropBox().height, 841.89 + RECIPIENT_BANNER_HEIGHT, 0.01)
    assert.include(pageContent(page), await encodedLabel())
    // Le contenu d’origine est toujours là, sous le bandeau.
    assert.include(pageContent(page), await encoded('Devis fournisseur, page 1'))
  })

  test('un PDF multipages ne change que sa première page', async ({ assert }) => {
    const pdf = await realPdf({ pages: 3 })

    const document = await PDFDocument.load(await service().stampRecipient(pdf, stamp))

    assert.equal(document.getPageCount(), 3)
    assert.closeTo(document.getPage(0).getHeight(), 841.89 + RECIPIENT_BANNER_HEIGHT, 0.01)
    assert.closeTo(document.getPage(1).getHeight(), 841.89, 0.01)
    assert.closeTo(document.getPage(2).getHeight(), 841.89, 0.01)
    assert.notInclude(pageContent(document.getPage(1)), await encodedLabel())
  })

  test('sans place pour le bandeau, une page de garde est insérée avant le devis', async ({
    assert,
  }) => {
    const rotated = await realPdf({ pages: 2, rotation: 90 })
    const full = await realPdf({ height: PDF_MAX_PAGE_SIZE })

    const fromRotated = await PDFDocument.load(await service().stampRecipient(rotated, stamp))
    const fromFull = await PDFDocument.load(await service().stampRecipient(full, stamp))

    assert.equal(fromRotated.getPageCount(), 3)
    assert.include(pageContent(fromRotated.getPage(0)), await encodedLabel())
    assert.equal(fromRotated.getPage(1).getRotation().angle, 90)
    assert.equal(fromFull.getPageCount(), 2)
    assert.closeTo(fromFull.getPage(1).getHeight(), PDF_MAX_PAGE_SIZE, 0.01)
  })

  test('un nom trop long est réduit puis tronqué, sans changer la mise en page', async ({
    assert,
  }) => {
    const long = { agencyName: `Agence ${'très longue '.repeat(30)}`, rfqRef: '7' }

    const stamped = await service().stampRecipient(await realPdf(), long)

    const document = await PDFDocument.load(stamped)
    assert.equal(document.getPageCount(), 1)
    assert.closeTo(document.getPage(0).getHeight(), 841.89 + RECIPIENT_BANNER_HEIGHT, 0.01)
  })

  test('un nom d’agence que la police ne sait pas écrire laisse le PDF tel quel', async ({
    assert,
  }) => {
    const pdf = await realPdf()
    const names = ['Агентство Свет', 'Agence 東京', 'Πρακτορείο']

    const outputs = await Promise.all(
      names.map((agencyName) => service().stampRecipient(pdf, { agencyName, rfqRef: '7' }))
    )

    outputs.forEach((output) => assert.strictEqual(output, pdf))
  })

  test('un emplacement de signature vide n’empêche pas l’apposition', async ({ assert }) => {
    const placeholder = await signedPdf({ filled: false })

    const stamped = await service().stampRecipient(placeholder, stamp)

    assert.notStrictEqual(stamped, placeholder)
    const document = await PDFDocument.load(stamped)
    assert.closeTo(document.getPage(0).getHeight(), 841.89 + RECIPIENT_BANNER_HEIGHT, 0.01)
  })

  test('un PDF chiffré, signé ou illisible est renvoyé tel quel, sans erreur', async ({
    assert,
  }) => {
    const inputs = [await encryptedPdf(), await signedPdf(), Buffer.from('%PDF-1.4 pas un pdf')]

    const outputs = await Promise.all(inputs.map((input) => service().stampRecipient(input, stamp)))

    outputs.forEach((output, index) => assert.strictEqual(output, inputs[index]))
  })
})
