import { test } from '@japa/runner'
import { csvCell, csvLine } from '#shared/helpers/csv'

test.group('Export CSV', () => {
  test('une cellule simple n’est pas entourée de guillemets', ({ assert }) => {
    assert.equal(csvCell('Crayon'), 'Crayon')
    assert.equal(csvCell(12), '12')
    assert.equal(csvCell(null), '')
  })

  test('une cellule contenant le séparateur, un guillemet ou un saut de ligne est échappée', ({
    assert,
  }) => {
    assert.equal(csvCell('a;b'), '"a;b"')
    assert.equal(csvCell('dit "oui"'), '"dit ""oui"""')
    assert.equal(csvCell('ligne 1\nligne 2'), '"ligne 1\nligne 2"')
  })

  test('une valeur qui ressemble à une formule est neutralisée', ({ assert }) => {
    assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
    assert.equal(csvCell('+33 1'), "'+33 1")
    assert.equal(csvCell('-5'), "'-5")
    assert.equal(csvCell('@SUM'), "'@SUM")
  })

  test('csvLine joint les cellules avec le séparateur', ({ assert }) => {
    assert.equal(csvLine(['1', 'prix', 'Format invalide', '12,5']), '1;prix;Format invalide;12,5')
  })
})
