// RR-28: importing this module registers <opf-deck>. It is the only file of the element with a side effect; import it from a
// browser entry point (or use `defineOpfDeck()` from `@openpresentation/opf-render/element` when you want to choose when).
import { defineOpfDeck } from "./element.js";

defineOpfDeck();
