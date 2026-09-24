// Transparent 400x1 PNG (78 bytes, generated once with node:zlib). Discord sizes an
// embed to its content, so this invisible image as `image` stretches every compact
// card to the same full width. Sent once per message as an attachment.
const SPACER_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAZAAAAABCAYAAADw8vieAAAAFUlEQVR42mNgGAWjYBSMglEwCsgAAAZBAAElCJ3eAAAAAElFTkSuQmCC';
const SPACER = { name: 'spacer.png', buffer: Buffer.from(SPACER_PNG_BASE64, 'base64') };
const SPACER_URL = `attachment://${SPACER.name}`;

module.exports = { SPACER, SPACER_URL };
