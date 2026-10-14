// The playground is the host: its font gate runs before this synchronous render, and clears the cache when faces load.
// Selecting every missing slide in one call makes the renderer resolve/compose the deck once, including hidden slides.
export function createThumbnailCache({toSvg, getOptions}) {
  const cache = new Map();
  let context;
  let preparedDeck;
  const key = (deck, index) => JSON.stringify([index, deck.slides.length, deck.slides[index]]);
  const contextOf = (deck, options) => {
    const {slides, ...metadata} = deck;
    const {fonts: _fonts, ...settings} = options;
    // Deck metadata and preceding sections can change inherited furniture, variables, data and design on another slide.
    return JSON.stringify([metadata, slides.map(slide => slide.section), settings]);
  };
  function prepare(deck) {
    const options = getOptions();
    const nextContext = contextOf(deck, options);
    if (nextContext !== context) cache.clear();
    context = nextContext;
    preparedDeck = deck;
    const keys = deck.slides.map((_, index) => key(deck, index));
    const missing = keys.flatMap((value, index) => cache.has(value) ? [] : [index]);
    if (missing.length) {
      try {
        const images = toSvg(deck, missing.map(index => index + 1), options);
        missing.forEach((index, position) => cache.set(keys[index], images[position]));
      } catch {
        // A paint error can belong to just one slide (for example an invalid XML character). Retain the old per-slide
        // "Preview unavailable" behavior in this exceptional path instead of hiding every otherwise valid thumbnail.
        for (const index of missing) {
          try { cache.set(keys[index], toSvg(deck, index + 1, options)); }
          catch { cache.set(keys[index], 'Preview unavailable'); }
        }
      }
    }
    const live = new Set(keys);
    for (const value of cache.keys()) if (!live.has(value)) cache.delete(value);
  }
  return {
    prepare,
    html(deck, index) {
      const value = key(deck, index);
      if (deck !== preparedDeck || !cache.has(value)) prepare(deck);
      return cache.get(value);
    },
    clear: () => { cache.clear(); preparedDeck = undefined; },
  };
}
