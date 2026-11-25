/** FR-03: the slides a link can name, as picker options `slide:<id>`; a slide with no id is listed, disabled. */
export function slideLinkOptions(presentation) {
  const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
  return slides.map((slide, index) => {
    const title = typeof slide?.title === "string" ? slide.title : Array.isArray(slide?.title) ? slide.title.map((run) => (typeof run === "string" ? run : run?.text ?? "")).join("") : "";
    const label = `${index + 1}. ${title || "Untitled"}`;
    return typeof slide?.id === "string" && slide.id
      ? { value: `slide:${slide.id}`, label }
      : { value: `slide:#${index}`, label: `${label} (needs an id)`, disabled: true, title: "Give the slide an id to link to it" };
  });
}
