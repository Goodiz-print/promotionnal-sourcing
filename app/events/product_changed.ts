/**
 * Un produit a changé d'une façon qui concerne l'index de recherche (création,
 * mise à jour, suppression, traduction, vecteur, modération). Le listener met en
 * queue sa synchronisation (#112) ; les services émetteurs ne connaissent pas le
 * moteur de recherche.
 */
export default class ProductChanged {
  constructor(public productId: number) {}
}
