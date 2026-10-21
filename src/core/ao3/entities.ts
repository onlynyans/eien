// HTML 4's named character references (and XHTML's &apos;): every name a
// writer, a word processor or AO3 is likely to have used, read the same way
// by Paste, Copy for AO3's book exports and the PDF's browser. HTML 5 has
// two thousand more; a name not here is kept as its words.

/** Names for a run of characters from `first` on, in order. */
const RUNS: readonly [number, string][] = [
  [
    160,
    'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml',
  ],
  [913, 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho'],
  [931, 'Sigma Tau Upsilon Phi Chi Psi Omega'],
  [
    945,
    'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigmaf sigma tau upsilon phi chi psi omega',
  ],
  [8592, 'larr uarr rarr darr harr'],
  [8656, 'lArr uArr rArr dArr hArr'],
  [8968, 'lceil rceil lfloor rfloor'],
  [8204, 'zwnj zwj lrm rlm'],
];

/** The rest, one by one. */
const SINGLE =
  'quot 34 amp 38 apos 39 lt 60 gt 62 OElig 338 oelig 339 Scaron 352 scaron 353 Yuml 376 fnof 402 circ 710 tilde 732 thetasym 977 upsih 978 piv 982 ensp 8194 emsp 8195 thinsp 8201 ndash 8211 mdash 8212 lsquo 8216 rsquo 8217 sbquo 8218 ldquo 8220 rdquo 8221 bdquo 8222 dagger 8224 Dagger 8225 bull 8226 hellip 8230 permil 8240 prime 8242 Prime 8243 lsaquo 8249 rsaquo 8250 oline 8254 frasl 8260 euro 8364 image 8465 weierp 8472 real 8476 trade 8482 alefsym 8501 crarr 8629 forall 8704 part 8706 exist 8707 empty 8709 nabla 8711 isin 8712 notin 8713 ni 8715 prod 8719 sum 8721 minus 8722 lowast 8727 radic 8730 prop 8733 infin 8734 ang 8736 and 8743 or 8744 cap 8745 cup 8746 int 8747 there4 8756 sim 8764 cong 8773 asymp 8776 ne 8800 equiv 8801 le 8804 ge 8805 sub 8834 sup 8835 nsub 8836 sube 8838 supe 8839 oplus 8853 otimes 8855 perp 8869 sdot 8901 lang 9001 rang 9002 loz 9674 spades 9824 clubs 9827 hearts 9829 diams 9830';

/** Each name's character. */
export const NAMED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ...RUNS.flatMap(([first, names]) =>
    names.split(' ').map((name, i): [string, string] => [name, String.fromCodePoint(first + i)]),
  ),
  ...SINGLE.split(' ')
    .flatMap((part, i, all) => (i % 2 === 0 ? [[part, all[i + 1] as string] as const] : []))
    .map(([name, code]): [string, string] => [name, String.fromCodePoint(Number(code))]),
]);
