import { test } from '@japa/runner'
import { degrees, PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import {
  addBanner,
  addCoverPage,
  canHoldBanner,
  fitText,
  recipientLabel,
  refusalOf,
} from '#services/pdf/recipient_stamp'
import { PDF_MAX_PAGE_SIZE, RECIPIENT_BANNER_HEIGHT } from '#shared/types/pdf'
import { encoded, pageContent, realPdf, signedPdf } from '#tests/utils/pdf'

/** Mise en page pure du bandeau « devis établi pour » (#238), fonction par fonction. */

const A4: [number, number] = [595.28, 841.89]
const label = 'Devis établi pour : Agence Lumière — demande n° 42'

async function blankDocument(): Promise<{ document: PDFDocument; font: PDFFont }> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  return { document, font }
}

/** Le document enregistré puis relu : ses flux de contenu deviennent lisibles (`pageContent`). */
async function saved(document: PDFDocument): Promise<PDFDocument> {
  return PDFDocument.load(await document.save())
}

async function loaded(content: Buffer): Promise<{ document: PDFDocument; font: PDFFont }> {
  const document = await PDFDocument.load(content)
  const font = await document.embedFont(StandardFonts.Helvetica)
  return { document, font }
}

test.group('recipientLabel', () => {
  test('nomme l’agence et la demande', ({ assert }) => {
    assert.equal(
      recipientLabel({ agencyName: 'Agence Lumière', rfqRef: '42' }),
      'Devis établi pour : Agence Lumière — demande n° 42'
    )
  })

  test('retire les espaces autour du nom de l’agence', ({ assert }) => {
    assert.equal(
      recipientLabel({ agencyName: '  Agence Lumière  ', rfqRef: '7' }),
      'Devis établi pour : Agence Lumière — demande n° 7'
    )
  })
})

test.group('refusalOf', () => {
  test('un PDF ordinaire peut porter la mention', async ({ assert }) => {
    const { document, font } = await loaded(await realPdf())

    assert.isNull(refusalOf(document, label, font))
  })

  test('un PDF signé est refusé', async ({ assert }) => {
    const { document, font } = await loaded(await signedPdf())

    assert.equal(refusalOf(document, label, font), 'signed')
  })

  test('un emplacement de signature vide n’est pas une signature', async ({ assert }) => {
    const { document, font } = await loaded(await signedPdf({ filled: false }))

    assert.isNull(refusalOf(document, label, font))
  })

  test('un texte que la police standard ne sait pas écrire est refusé', async ({ assert }) => {
    const { document, font } = await loaded(await realPdf())

    assert.equal(refusalOf(document, 'Devis établi pour : Агентство', font), 'unencodable')
  })

  test('la signature prime sur l’encodage', async ({ assert }) => {
    const { document, font } = await loaded(await signedPdf())

    assert.equal(refusalOf(document, 'Агентство', font), 'signed')
  })
})

test.group('canHoldBanner', () => {
  test('une page droite qui a la place accepte le bandeau', async ({ assert }) => {
    const { document } = await blankDocument()

    assert.isTrue(canHoldBanner(document.addPage(A4)))
  })

  test('une page pivotée le refuse', async ({ assert }) => {
    const { document } = await blankDocument()
    const pages = [90, 180, 270].map((angle) => {
      const page = document.addPage(A4)
      page.setRotation(degrees(angle))
      return page
    })

    assert.deepEqual(
      pages.map((page) => canHoldBanner(page)),
      [false, false, false]
    )
  })

  test('un tour complet compte comme une page droite', async ({ assert }) => {
    const { document } = await blankDocument()
    const page = document.addPage(A4)
    page.setRotation(degrees(360))

    assert.isTrue(canHoldBanner(page))
  })

  test('une page qui dépasserait la taille maximale le refuse', async ({ assert }) => {
    const { document } = await blankDocument()
    const limit = PDF_MAX_PAGE_SIZE - RECIPIENT_BANNER_HEIGHT

    assert.isTrue(canHoldBanner(document.addPage([A4[0], limit])))
    assert.isFalse(canHoldBanner(document.addPage([A4[0], limit + 1])))
  })
})

test.group('fitText', () => {
  test('un texte qui tient garde la taille par défaut', async ({ assert }) => {
    const { font } = await blankDocument()

    assert.deepEqual(fitText('Court', font, 500), { text: 'Court', size: 10 })
  })

  test('un texte un peu trop long est réduit sans être coupé', async ({ assert }) => {
    const { font } = await blankDocument()
    const width = font.widthOfTextAtSize(label, 10)

    const fitted = fitText(label, font, width * 0.8)

    assert.equal(fitted.text, label)
    assert.isAbove(fitted.size, 6)
    assert.isBelow(fitted.size, 10)
  })

  test('un texte bien trop long est tronqué à la taille minimale', async ({ assert }) => {
    const { font } = await blankDocument()
    const maxWidth = 200

    const fitted = fitText(label.repeat(10), font, maxWidth)

    assert.equal(fitted.size, 6)
    assert.isTrue(fitted.text.endsWith('…'))
    assert.isAtMost(font.widthOfTextAtSize(fitted.text, fitted.size), maxWidth)
    // Le plus long préfixe qui tient : un caractère de plus déborderait.
    const longer = label.repeat(10).slice(0, fitted.text.length) + '…'
    assert.isAbove(font.widthOfTextAtSize(longer, fitted.size), maxWidth)
  })

  test('sans aucune place, il ne reste que les points de suspension', async ({ assert }) => {
    const { font } = await blankDocument()

    assert.deepEqual(fitText(label, font, 1), { text: '…', size: 6 })
  })
})

test.group('addBanner', () => {
  test('agrandit la page vers le haut et y écrit la mention', async ({ assert }) => {
    const { document, font } = await loaded(await realPdf())
    const page = document.getPage(0)

    addBanner(page, label, font)

    assert.closeTo(page.getMediaBox().height, A4[1] + RECIPIENT_BANNER_HEIGHT, 0.01)
    assert.closeTo(page.getCropBox().height, A4[1] + RECIPIENT_BANNER_HEIGHT, 0.01)
    assert.equal(page.getMediaBox().y, 0)
    const reread = await saved(document)
    const content = pageContent(reread.getPage(0))
    assert.include(content, await encoded(label))
    assert.include(content, await encoded('Devis fournisseur, page 1'))
  })

  test('pose le bandeau au-dessus de la zone visible, sans agrandir la page si elle a la place', async ({
    assert,
  }) => {
    const { document, font } = await blankDocument()
    const page = document.addPage(A4)
    page.setCropBox(10, 20, 500, 700)

    addBanner(page, label, font)

    assert.deepEqual(page.getCropBox(), {
      x: 10,
      y: 20,
      width: 500,
      height: 700 + RECIPIENT_BANNER_HEIGHT,
    })
    assert.closeTo(page.getMediaBox().height, A4[1], 0.01)
  })

  test('agrandit la page quand la zone visible touche son bord haut', async ({ assert }) => {
    const { document, font } = await blankDocument()
    const page = document.addPage(A4)
    page.setCropBox(0, 100, A4[0], A4[1] - 110)

    addBanner(page, label, font)

    const crop = page.getCropBox()
    assert.closeTo(crop.y + crop.height, A4[1] - 10 + RECIPIENT_BANNER_HEIGHT, 0.01)
    assert.closeTo(page.getMediaBox().height, A4[1] - 10 + RECIPIENT_BANNER_HEIGHT, 0.01)
  })
})

test.group('addCoverPage', () => {
  test('insère une page A4 portant la mention avant le devis', async ({ assert }) => {
    const { document, font } = await loaded(await realPdf({ pages: 2 }))

    addCoverPage(document, label, font)

    assert.equal(document.getPageCount(), 3)
    const cover = document.getPage(0)
    assert.closeTo(cover.getWidth(), A4[0], 0.01)
    assert.closeTo(cover.getHeight(), A4[1], 0.01)
    const reread = await saved(document)
    assert.include(pageContent(reread.getPage(0)), await encoded(label))
    assert.include(pageContent(reread.getPage(1)), await encoded('Devis fournisseur, page 1'))
  })
})
