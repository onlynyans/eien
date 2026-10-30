export { bookHref, bookLinkOf } from './book-link';
export { EPUB_CAPS, type EpubCaps } from './caps';
export type { Chapter } from './chapter';
export { chapterBeside, chapterTitle } from './chapters';
export type { ContentsEntry, PrintPage } from './contents';
export { type Epub, type EpubImage, type EpubSpineItem, epubKey, openEpub } from './epub';
export type { SpineItem } from './package';
export { offsetOf, type Spot, spotOf } from './place';
export { bookFraction, chapterFraction, percent } from './progress';
export { citation, type QuoteSource, quoted, withQuote } from './quote';
export { parseReading, READING_FOLDER, type Reading, readingPath, withReading } from './reading';
export { isRefusal, type Refusal, type RefusalKind, refusalWords } from './refusal';
export { CURL_STRIPS, type Matrix, type PageBox, type Point, type Polygon } from './turn/curl';
export { type CurlFrame, type CurlLengths, type CurlStrip, curlFrame } from './turn/curl-frame';
export {
  beginCurl,
  type CurlPhase,
  type CurlTurn,
  catchCurl,
  dragCurl,
  finishCurl,
  keyCurl,
  letGoCurl,
  tickCurl,
  turned,
  type Way,
} from './turn/curl-turn';
export type { Light, Stop } from './turn/light';
export { curlTime, isInstant, SLOWEST, slideTime, turnScale, wordsTime } from './turn/speed';
export { FIRST_STROKE, nextStroke, type Stroke } from './turn/stroke';
export type { ZipAddress } from './zip-path';
export type { Inflate } from './zip-read';
