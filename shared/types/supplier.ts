export interface SupplierType {
  id: number
  name: string
  slug: string
  country: string
  website: string | null
  email: string | null
  phone: string | null
  description: string | null
  logoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateSupplierData {
  name: string
  slug: string
  country?: string
  website?: string | null
  email?: string | null
  phone?: string | null
  description?: string | null
  logoUrl?: string | null
  isActive?: boolean
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {}
