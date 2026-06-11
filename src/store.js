// The Store comonad.
//
//   Store s a  =  (peek : s -> a,  focus : s)
//
// A value of type `a` living in a space `s`, with one position singled out.
// For coaurora, s = Coord (a pixel) and a = Colour — so the whole green field,
// plus the pixel we're currently looking at.
//
//   extract w    = w.peek(w.pos)                        -- the value under the focus
//   extend  f w  = Store(p => f(seek(p, w)), w.pos)     -- recompute the WHOLE field,
//                                                          each point free to consult
//                                                          its neighbourhood
//   seek  p w    = Store(w.peek, p)                     -- move the focus
//   fmap  g w    = Store(p => g(w.peek(p)), w.pos)
//
// `extend` is the dual of monadic `bind`: instead of *sequencing* effects it
// *spreads* a local computation across every position. A blur is the canonical
// example — `extend (avg . neighbourhood)`.

export const Store   = (peek, pos) => ({ peek, pos });
export const extract = (w)         => w.peek(w.pos);
export const extend  = (f, w)      => Store((p) => f(Store(w.peek, p)), w.pos);
export const seek    = (pos, w)    => Store(w.peek, pos);
export const fmap    = (g, w)      => Store((p) => g(w.peek(p)), w.pos);
