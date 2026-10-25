import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { readFile } from 'node:fs/promises'
import OrganizationDocument from '#models/organization_document'
import Organization from '#models/organization'
import Product from '#models/product'
import ProductDocument from '#models/product_document'
import PdfService from '#services/pdf_service'
import StorageService from '#services/storage/storage_service'
import { StorageSourceException } from '#exceptions/storage_errors'
import { InvalidDocumentException } from '#exceptions/document_errors'
import {
  DOCUMENT_MIME_TYPE,
  DEFAULT_PRODUCT_DOCUMENT_TYPE,
  type OrganizationDocumentKind,
  type ProductDocumentType,
} from '#shared/types/document'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type StorageObject from '#models/storage_object'

const PDF_HEADER = Buffer.from('%PDF-')

interface StoredPdf {
  storageObject: StorageObject
  sizeBytes: number
}

/**
 * Documents PDF des fournisseurs (#60) : compression, stockage, rattachement et
 * retrait. Toute écriture de référence passe par `StorageService` pour qu'aucun
 * fichier ne reste orphelin.
 */
@inject()
export default class DocumentService {
  constructor(
    private storage: StorageService,
    private pdf: PdfService
  ) {}

  async addToOrganization(
    organization: Organization,
    file: MultipartFile,
    kind: OrganizationDocumentKind
  ): Promise<OrganizationDocument> {
    const stored = await this.storePdf(file)
    try {
      return await OrganizationDocument.create({
        organizationId: organization.id,
        kind,
        storageObjectId: stored.storageObject.id,
        originalName: file.clientName,
        sizeBytes: stored.sizeBytes,
      })
    } catch (error) {
      await this.storage.discard([stored.storageObject.id])
      throw error
    }
  }

  /** Documents du profil d'une organisation (fichier présent), du plus ancien au plus récent. */
  listForOrganization(organization: Organization): Promise<OrganizationDocument[]> {
    return OrganizationDocument.query()
      .where('organizationId', organization.id)
      .whereNotNull('storageObjectId')
      .preload('storageObject')
      .orderBy('id')
  }

  /** URL publique du fichier d'un document. */
  urlFor = (object: StorageObject): string => this.storage.urlFor(object)

  /** Document d'une organisation, ou `null` s'il n'est pas le sien. */
  findOrganizationDocument(organization: Organization, documentId: number) {
    return OrganizationDocument.query()
      .where('id', documentId)
      .where('organizationId', organization.id)
      .first()
  }

  /** Fiche technique d'un produit, ou `null` si elle ne lui appartient pas. */
  findProductDocument(product: Product, documentId: number) {
    return ProductDocument.query().where('id', documentId).where('productId', product.id).first()
  }

  async addToProduct(
    product: Product,
    file: MultipartFile,
    type: ProductDocumentType = DEFAULT_PRODUCT_DOCUMENT_TYPE
  ): Promise<ProductDocument> {
    const stored = await this.storePdf(file)
    try {
      return await ProductDocument.create({
        productId: product.id,
        type,
        storageObjectId: stored.storageObject.id,
        originalName: file.clientName,
        sizeBytes: stored.sizeBytes,
      })
    } catch (error) {
      await this.storage.discard([stored.storageObject.id])
      throw error
    }
  }

  /** Retire le document ; le fichier est purgé si plus rien ne le référence. */
  async removeOrganizationDocument(document: OrganizationDocument): Promise<void> {
    await this.removeWithFile(document, (trx) => document.useTransaction(trx).delete())
  }

  /** Retire la fiche technique ; le fichier est purgé si plus rien ne le référence. */
  async removeProductDocument(document: ProductDocument): Promise<void> {
    await this.removeWithFile(document, (trx) => document.useTransaction(trx).delete())
  }

  /**
   * Supprime la ligne et libère son fichier **dans la même transaction**, puis
   * planifie la purge après le commit.
   */
  private async removeWithFile(
    document: OrganizationDocument | ProductDocument,
    deleteRow: (trx: TransactionClientContract) => Promise<void>
  ): Promise<void> {
    const tombstone = await db.transaction(async (trx) => {
      await deleteRow(trx)
      return this.storage.release(trx, document.storageObjectId)
    })
    await this.storage.dispatchDeletions([tombstone])
  }

  /**
   * Lit le PDF, le compresse (repli sans compression si Ghostscript manque) et le
   * stocke. Le contenu porte le type `application/pdf` ; la clé reste déterministe.
   */
  private async storePdf(file: MultipartFile): Promise<StoredPdf> {
    if (!file.tmpPath) throw new StorageSourceException()
    const original = await readFile(file.tmpPath)
    // L'extension ne prouve rien : un PDF commence par son en-tête `%PDF-`.
    if (!original.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) {
      throw new InvalidDocumentException()
    }
    const { content } = await this.pdf.compress(original)
    const storageObject = await this.storage.storeContent(content, 'pdf', DOCUMENT_MIME_TYPE)
    return { storageObject, sizeBytes: content.length }
  }
}
