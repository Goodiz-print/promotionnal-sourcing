import env from '#start/env'
import { v2 as cloudinary } from 'cloudinary'

/**
 * Client Cloudinary configuré à partir des variables d'environnement.
 * `secure: true` force les URLs `https`.
 */
cloudinary.config({
  cloud_name: env.get('CLOUDINARY_CLOUD_NAME'),
  api_key: env.get('CLOUDINARY_API_KEY'),
  api_secret: env.get('CLOUDINARY_API_SECRET'),
  secure: true,
})

export default cloudinary
