function isHTTPSignatureDigestValid(rawBody, req) {
  if (req.headers[HTTP_SIGNATURE.HEADER_NAME] && req.headers.digest) {
    return buildDigest(rawBody.toString()) === req.headers.digest
  }

  return true
}

function buildDigest(body) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body)

  return 'SHA-256=' + sha256(rawBody, 'base64')
}

module.exports = {
  isHTTPSignatureDigestValid
}
