import sharp from 'sharp';
// Faithful crops of the supplied official artwork. No redrawing or colour changes.
await sharp('public/brand-original.png')
  .extract({ left: 245, top: 880, width: 380, height: 83 })
  .resize({ width: 380 })
  .png()
  .toFile('public/brand-wordmark.png');
await sharp('public/brand-wordmark.png').webp({ quality: 95 }).toFile('public/brand-wordmark.webp');
await sharp('public/brand-original.png')
  .extract({ left: 300, top: 700, width: 250, height: 180 })
  .resize(64, 64, { fit: 'contain', background: '#071321' })
  .png()
  .toFile('public/favicon.png');
