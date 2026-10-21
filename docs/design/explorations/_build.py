# Builds each exploration from _src: every page carries the shared CSS and JS
# inline, so a page is one file. Run: python3 _build.py (from this folder).
from pathlib import Path

here = Path(__file__).parent
src = here / '_src'
css = (src / 'shared.css').read_text()
js = (src / 'shared.js').read_text()
for page in sorted(src.glob('*.html')):
    text = page.read_text().replace('/*@shared-css*/', css).replace('/*@shared-js*/', js)
    (here / page.name).write_text(text)
    print('built', page.name)
