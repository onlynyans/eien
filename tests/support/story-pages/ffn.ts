// FanFiction.Net's story pages as its markup has them, the desktop site's
// and the phone site's, written out by hand (the site isn't reachable from
// where these tests run) and trimmed to what the reader reads and what sits
// round it. A change on the site that breaks the reader should be copied in
// here, so the test shows it.

/** Chapter 2 of 3 on www.fanfiction.net. */
export const FFN_CHAPTER = `<!DOCTYPE html><html><head><title>Beneath the Walls Chapter 2: The Gate, a harry potter fanfic | FanFiction</title>
<script>var storyid = 42;</script></head><body>
<div id="top"><div><a href="/"><img src="/static/fflogo.png"></a></div></div>
<div id="content_parent" class="maxwidth">
<div id="pre_story_links"><span class="lc-left"><a class="xcontrast_txt" href="/book/">Books</a><span class="xcontrast_txt icon-chevron-right xicon-section-arrow"></span><a class="xcontrast_txt" href="/book/Harry-Potter/">Harry Potter</a></span></div>
<div id="content_wrapper"><div id="content_wrapper_inner">
<div id="profile_top" style="min-height:112px;">
  <button class="btn pull-right icon-heart" type="button" onclick="$('#follow_area').modal();"> Follow/Fav</button>
  <span><img class="cimage" src="//ffcdn.net/image/1/75/" width="75" height="100"></span>
  <b class="xcontrast_txt">Beneath the Walls</b>
  <span class="xcontrast_txt"><div style="height:5px"></div>By:</span> <a class="xcontrast_txt" href="/u/7/Rook">Rook</a> <span class="icon-mail-1 xcontrast_txt"></span>
  <div style="margin-top:2px" class="xcontrast_txt">The walls held for forty days &amp; nights.</div>
  <span class="xgray xcontrast_txt">Rated: <a class="xcontrast_txt" href="https://www.fictionratings.com/" target="rating">Fiction  T</a> - English - Drama/Romance -  Hermione G., Ron W. - Chapters: 3   - Words: 12,345 - Reviews: <a href="/r/42/">8</a> - Favs: 9 - Follows: 10 - Updated: <span data-xutime="1">Mar 3</span> - Published: <span data-xutime="2">Jan 2</span> - id: 42 </span>
</div>
<span class="lc-left"><select id="chap_select" title="Chapter Navigation" name="chapter" onchange="self.location = '/s/42/'+ this.options[this.selectedIndex].value + '/Beneath-the-Walls';"><option value="1">1. The Wall</option><option value="2" selected>2. The Gate</option><option value="3">3. The Keep</option></select>
<button class="btn" type="button" onclick="self.location='/s/42/3/Beneath-the-Walls'">Next &gt;</button></span>
<div role="main" aria-label="story content" style="font-size:1.1em;">
<div class="storytext xcontrast_txt nocopy" id="storytext">
<p>The gate <em>groaned</em> at dawn.</p>
<p style="text-align:center;"><strong>* * *</strong></p>
<hr size="1" noshade>
<p>She <span style="text-decoration:underline;">read</span> on.</p>
</div></div>
<div style="height:5px"></div>
<span class="lc-left"><select id="chap_select" title="Chapter Navigation" name="chapter"><option value="1">1. The Wall</option><option value="2" selected>2. The Gate</option><option value="3">3. The Keep</option></select></span>
<div id="review"><textarea id="review_postbox"></textarea></div>
</div></div></div></body></html>`;

/** A one-shot: no chapter list at all. */
export const FFN_ONESHOT = `<!DOCTYPE html><html><head><title>Lantern, a naruto fanfic | FanFiction</title></head><body>
<div id="pre_story_links"><span class="lc-left"><a class="xcontrast_txt" href="/anime/">Anime/Manga</a><span class="icon-chevron-right"></span><a class="xcontrast_txt" href="/anime/Naruto/">Naruto</a></span></div>
<div id="profile_top"><b class="xcontrast_txt">Lantern</b> <span class="xcontrast_txt">By:</span> <a class="xcontrast_txt" href="/u/8/Wren">Wren</a>
<div class="xcontrast_txt">One night.</div>
<span class="xgray xcontrast_txt">Rated: <a href="https://www.fictionratings.com/">Fiction  K+</a> - English - Words: 900 - Published: <span>Feb 1</span> - Status: Complete - id: 43 </span></div>
<div class="storytext xcontrast_txt nocopy" id="storytext"><p>A light.</p></div>
</body></html>`;

/** Chapter 2 on m.fanfiction.net: no profile block, the story in #storycontent, words for links. */
export const FFN_PHONE = `<!DOCTYPE html><html><head><title>Beneath the Walls Chapter 2: The Gate, a harry potter fanfic | FanFiction</title></head><body>
<div id="top"><a href="/">FanFiction</a></div>
<div id="content">
<div align="center"><b>Beneath the Walls</b> by <a href="/u/7/Rook">Rook</a></div>
<div align="center">Chapter 2: The Gate</div>
<div class="storycontent nocopy" id="storycontent"><p>The gate groaned at dawn.</p></div>
<div align="center"><a href="/s/42/1/Beneath-the-Walls">&#171; Prev</a> <a href="/s/42/3/Beneath-the-Walls">Next &#187;</a></div>
</div></body></html>`;
