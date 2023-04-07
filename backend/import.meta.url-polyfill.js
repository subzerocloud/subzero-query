export const import_meta_url =
    typeof document === 'undefined' ? new (require('url'.replace('', '')).URL)('file:' + __filename).href :
        (document.currentScript && document.currentScript.src || new URL('server.cjs', document.baseURI).href)
