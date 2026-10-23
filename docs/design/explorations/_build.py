# Builds each exploration from _src: every page carries the shared CSS and JS
# inline, so a page is one file. A page may also take a family's own shared
# file with /*@include:name*/ (the table pages' table.css, the corner pages'
# corner.js). Run: python3 _build.py (from this folder).
import re
from pathlib import Path

here = Path(__file__).parent
src = here / '_src'
css = (src / 'shared.css').read_text()
js = (src / 'shared.js').read_text()
for page in sorted(src.glob('*.html')):
    text = page.read_text().replace('/*@shared-css*/', css).replace('/*@shared-js*/', js)
    while '/*@include:' in text:  # an included file may include another
        text = re.sub(r'/\*@include:([\w.-]+)\*/', lambda m: (src / m.group(1)).read_text(), text)
    (here / page.name).write_text(text)
    print('built', page.name)
