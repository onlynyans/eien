// AO3's pages as its markup has them (otwarchive's work views, written out by
// hand: the archive isn't reachable from where these tests run), trimmed to
// what the extension reads and what sits round it. A change on the site that
// breaks the extension should be copied in here, so the test shows it.

const head = `<!DOCTYPE html><html lang="en"><head><title>Beneath the Walls - Chapter 2 - Rook - Harry Potter</title>
<style>#workskin p { color: red }</style><script>window.page = 1</script></head><body>
<div id="outer" class="wrapper"><div id="header"><h1 class="heading"><a href="/">Archive of Our Own</a></h1></div>
<div id="inner" class="wrapper"><div id="main" class="works-show region" role="main">`;

const meta = (chapters: string) => `
<div class="wrapper"><h3 class="landmark heading">Work Header</h3>
<dl class="work meta group">
  <dt class="rating tags">Rating:</dt>
  <dd class="rating tags"><ul class="commas"><li><a class="tag" href="/tags/Teen%20And%20Up%20Audiences/works">Teen And Up Audiences</a></li></ul></dd>
  <dt class="warning tags"><a href="/tos_faq#tags">Archive Warning</a>:</dt>
  <dd class="warning tags"><ul class="commas"><li><a class="tag" href="/tags/x">No Archive Warnings Apply</a></li></ul></dd>
  <dt class="fandom tags">Fandom:</dt>
  <dd class="fandom tags"><ul class="commas"><li><a class="tag" href="/tags/Harry%20Potter/works">Harry Potter - J. K. Rowling</a></li></ul></dd>
  <dt class="relationship tags">Relationship:</dt>
  <dd class="relationship tags"><ul class="commas"><li><a class="tag" href="/tags/a">Hermione Granger/Ron Weasley</a></li></ul></dd>
  <dt class="character tags">Characters:</dt>
  <dd class="character tags"><ul class="commas"><li><a class="tag" href="/tags/b">Hermione Granger</a></li><li><a class="tag" href="/tags/c">Ron Weasley</a></li></ul></dd>
  <dt class="freeform tags">Additional Tags:</dt>
  <dd class="freeform tags"><ul class="commas"><li><a class="tag" href="/tags/d">Siege</a></li><li><a class="tag" href="/tags/e">Slow Burn</a></li></ul></dd>
  <dt class="language">Language:</dt>
  <dd class="language" lang="en">English</dd>
  <dt class="stats">Stats:</dt>
  <dd class="stats"><dl class="stats"><dt class="published">Published:</dt><dd class="published">2026-01-02</dd><dt class="words">Words:</dt><dd class="words">12,345</dd><dt class="chapters">Chapters:</dt><dd class="chapters">${chapters}</dd><dt class="kudos">Kudos:</dt><dd class="kudos">99</dd></dl></dd>
</dl></div>`;

const preface = (summary: boolean) => `
<div class="preface group">
  <h2 class="title heading">
    Beneath the Walls
  </h2>
  <h3 class="byline heading"><a rel="author" href="/users/Rook/pseuds/Rook">Rook</a>, <a rel="author" href="/users/Wren/pseuds/Wren">Wren</a></h3>
  ${
    summary
      ? `<div class="summary module" role="complementary"><h3 class="heading">Summary:</h3>
  <blockquote class="userstuff"><p>The walls held for <em>forty</em> days.</p></blockquote></div>
  <div class="notes module" role="complementary"><h3 class="heading">Notes:</h3>
  <blockquote class="userstuff"><p>For S., who asked.</p></blockquote>
  <p class="jump">(See the end of the work for <a href="#work_endnotes">more notes</a>.)</p></div>`
      : ''
  }
</div>`;

const chapter = (n: number) => `
<div class="chapter" id="chapter-${n}">
  <div class="chapter preface group" role="complementary">
    <h3 class="title"><a href="/works/123/chapters/${1000 + n}">Chapter ${n}</a>: The Gate</h3>
    <div id="summary" class="summary module"><h3 class="heading">Summary:</h3><blockquote class="userstuff"><p>They open it.</p></blockquote></div>
    <div id="notes" class="notes module" role="complementary"><h3 class="heading">Notes:</h3><blockquote class="userstuff"><p>Short one.</p></blockquote></div>
  </div>
  <div class="userstuff module" role="article">
    <h3 class="landmark heading" id="work">Chapter Text</h3>
    <p>The gate <em>groaned</em> at dawn ${n}.</p>
    <p align="center">* * *</p>
    <p>She <a href="/works/9">read</a> on, <img src="/images/x.png" alt="a map"> and on.</p>
  </div>
  <div class="chapter preface group" role="complementary">
    <div id="chapter_${n}_endnotes" class="end notes module"><h3 class="heading">Notes:</h3><blockquote class="userstuff"><p>Thanks for reading.</p></blockquote></div>
  </div>
</div>`;

const navigation = `
<ul class="work navigation actions" role="menu">
  <li class="chapter entire"><a href="/works/123?view_full_work=true">Entire Work</a></li>
  <li class="chapter previous"><a href="/works/123/chapters/1001#workskin">← Previous Chapter</a></li>
  <li class="chapter next"><a href="/works/123/chapters/1003#workskin">Next Chapter →</a></li>
  <li class="chapter" aria-haspopup="true"><a href="#" class="collapsed">Chapter Index</a>
    <ul id="chapter_index" class="expandable secondary hidden"><li><form action="/works/123/chapters/1002" method="get">
    <p><select name="selected_id" id="selected_id"><option value="1001">1. The Wall</option><option selected="selected" value="1002">2. The Gate</option><option value="1003">3. The Keep</option></select>
    <span class="submit actions"><input type="submit" value="Go"></span></p></form></li></ul></li>
  <li class="comments" id="show_comments_link_top"><a href="/works/123?show_comments=true">Comments (5)</a></li>
</ul>`;

const end = `
<div class="afterword preface group">
  <div id="work_endnotes" class="end notes module"><h3 class="heading">Notes:</h3><blockquote class="userstuff"><p>The end, for now.</p></blockquote></div>
</div>`;

const foot = `</div></div></div><div id="footer"></div></body></html>`;

/** Chapter 2 of 3: the work's preface without its summary, as the archive shows a later chapter. */
export const AO3_CHAPTER = `${head}${navigation}${meta('2/3')}<div id="workskin">${preface(false)}
<div id="chapters" role="article"><h3 class="landmark heading">Chapter Text</h3>${chapter(2)}</div></div>${foot}`;

/** The whole work on one page (Entire Work): every chapter, the summary and the work's end notes. */
export const AO3_ENTIRE = `${head}${meta('2/?')}<div id="workskin">${preface(true)}
<div id="chapters" role="article">${chapter(1)}${chapter(2)}</div>${end}</div>${foot}`;

/** A work of one chapter: its text straight inside #chapters. */
export const AO3_ONESHOT = `${head}${meta('1/1')}<div id="workskin">${preface(true)}
<div id="chapters" role="article"><h3 class="landmark heading" id="work">Work Text:</h3>
<div class="userstuff"><p>Only <strong>this</strong>.</p></div></div>${end}</div>${foot}`;

/** The archive's question before a work for adults: no work on the page yet. */
export const AO3_ADULT = `${head}<p class="caution">This work could have adverse content.</p>
<ul class="actions"><li><a href="/works/123?view_adult=true">Proceed</a></li></ul>${foot}`;
