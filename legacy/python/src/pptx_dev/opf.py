"""Open Presentation Format (OPF) v1.0 Pydantic models.

A JSON-based file format for describing PowerPoint presentations. Agents
describe narratives, content, audience, and design intent — the engine
handles the OOXML complexity.

The models here are the Python port of the canonical TypeScript types in
``@pptx/sdk/opf`` and the JSON schema at ``https://pptx.dev/schema/opf/v1``.
They use ``populate_by_name`` so both camelCase JSON (the wire format) and
snake_case Python attributes work on input.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class _OPFBase(BaseModel):
    """Shared configuration for all OPF models."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="allow",
    )


# ─── Narrative / Meta ────────────────────────────────────────────────


class OPFNarrativeBeat(_OPFBase):
    """A single narrative beat — a labeled segment of the story arc.

    Slides reference beats via ``OPFSlide.beat``. Mirrors the Beat
    definition in narrative.schema.json
    (https://pptx.dev/schema/opf-narrative/v1) so library entries and
    inline OPF beats are interchangeable.
    """

    id: str
    name: str
    description: str | None = None
    instructions: str | None = None
    slide_count: int | None = Field(default=None, alias="slideCount")
    """Optional explicit slide count for this beat. Defaults to 1 when
    omitted; values >1 are reserved for beats that intentionally span
    multiple slides. Prefer decomposing a heavy beat into multiple beats
    over setting a high ``slideCount``. The validator emits a warning if
    the deck's actual count differs significantly."""
    slide_type: Literal["text", "image", "chart", "table", "code"] | None = Field(
        default=None, alias="slideType"
    )
    layout_hint: str | None = Field(default=None, alias="layoutHint")
    thought_cues: list[str] | None = Field(default=None, alias="thoughtCues")


class OPFNarrativePreview(_OPFBase):
    """Visual previews of a narrative, used by picker UIs and inline
    rendering."""

    src: str | None = None
    thumbnail_src: str | None = Field(default=None, alias="thumbnailSrc")
    vector_src: str | None = Field(default=None, alias="vectorSrc")


class OPFNarrativeDurationRange(_OPFBase):
    """Typical talk-length window a narrative suits."""

    min_minutes: float | None = Field(default=None, alias="minMinutes")
    max_minutes: float | None = Field(default=None, alias="maxMinutes")


class OPFNarrative(_OPFBase):
    """Structured storyline used by AI to shape generated content.

    Mirrors the OPF Narrative Template record at
    https://pptx.dev/schema/opf-narrative/v1 (sans ``$schema``) so library
    records and inline OPF narratives are interchangeable.

    When ``id`` matches a record in the resolved ``narratives`` catalog,
    the inline fields override matching fields on the catalog record (beats
    merge by beat ``id``). When ``id`` doesn't match, this object defines
    a fully custom inline narrative.

    Deck-level concerns (audience, tone, key messages, duration) live as
    siblings on ``meta`` rather than inside this object.
    """

    id: str | None = None
    name: str | None = None
    summary: str | None = None
    description: str | None = None
    audience_fit: list[str] | None = Field(default=None, alias="audienceFit")
    duration_range: OPFNarrativeDurationRange | None = Field(
        default=None, alias="durationRange"
    )
    tags: list[str] | None = None
    preview: OPFNarrativePreview | None = None
    beats: list[OPFNarrativeBeat] | None = None


# ``OPFSocials`` is a free-form mapping of platform-id → handle/URL string.
# Property keys resolve to the ``id`` of a ``socials`` catalog record
# (https://pptx.dev/schema/opf-social/v1; default catalog at
# https://www.pptx.gallery/socials). Common platform ids include
# ``linkedin``, ``x``, ``github``, ``youtube``, ``instagram``, ``facebook``,
# ``tiktok``, ``threads``, ``mastodon``, ``bluesky``. Used both for
# organizations and speakers.
OPFSocials = dict[str, str]


class OPFOrganization(_OPFBase):
    """An organization associated with the presentation.

    Typically the presenting company, but also hosts, partners, clients, or
    sponsors. Surfaced on cover slides, footers, and brand bars; the primary
    organization's logo is the default for ``design.brand.logo`` unless
    overridden.
    """

    id: str
    """Stable identifier, referenced by ``OPFSpeaker.organization_id``.
    Must be unique within the deck."""
    name: str
    legal_name: str | None = Field(default=None, alias="legalName")
    logo: str | None = None
    """Source for the organization's logo image. Accepts an HTTPS URL,
    data URI, relative path, or asset reference."""
    domain: str | None = None
    """Bare internet domain (e.g., 'acme.com')."""
    email: str | None = None
    """General contact email (e.g., 'hello@acme.com')."""
    phone: str | None = None
    """Main contact phone number. E.164 format is recommended
    (e.g., '+14155551234')."""
    tagline: str | None = None
    role: Literal["primary", "partner", "client", "sponsor", "host"] | None = None
    """Role of the organization relative to the presentation. When omitted,
    the first organization in the array is treated as primary."""
    socials: OPFSocials | None = None


class OPFSpeaker(_OPFBase):
    """A person presenting the deck.

    Used for cover slides, bio/intro slides, footer attribution, and panel
    formats with multiple presenters.
    """

    id: str
    """Stable identifier for cross-references within the deck. Must be unique
    within the deck."""
    name: str
    title: str | None = None
    photo: str | None = None
    email: str | None = None
    phone: str | None = None
    """Contact phone number. E.164 format is recommended
    (e.g., '+14155551234')."""
    bio: str | None = None
    organization_id: str | None = Field(default=None, alias="organizationId")
    """Reference to an ``OPFOrganization.id`` in ``meta.organizations``."""
    socials: OPFSocials | None = None


class OPFMeta(_OPFBase):
    title: str
    description: str | None = None
    filename: str | None = None
    subtitle: str | None = None
    organizations: list[OPFOrganization] | None = None
    """Organizations associated with the presentation. The primary
    organization (``role="primary"``, or first item if no role is set)
    drives default branding such as cover-slide logo."""
    speakers: list[OPFSpeaker] | None = None
    """People presenting the deck."""
    authors: list[str] | None = None
    """Optional credit list for people who authored or contributed to the
    deck, distinct from speakers. Use when the writer and presenter differ."""
    audience: str | None = None
    """Intended audience. Free-form description or a catalog id resolved
    against ``catalogs.audiences`` (default catalog at
    https://www.pptx.gallery/audiences)."""
    purpose: str | None = None
    narrative: Union[str, OPFNarrative] | None = None
    """Structured storyline. String shorthand (catalog id, URL, or ``pkg:``
    reference) for the common case; object form for inline overrides or
    fully custom narratives. Object shape mirrors
    https://pptx.dev/schema/opf-narrative/v1 (sans ``$schema``)."""
    language: str | None = None
    """Language for the presentation content. BCP-47 tag or catalog id
    resolved against ``catalogs.languages``."""
    tone: str | None = None
    """Desired tone. Resolves to the ``id`` of a ``tones`` catalog record
    (default catalog at https://www.pptx.gallery/tones). Historical enum
    values (``formal``, ``casual``, ``inspirational``, ``technical``,
    ``persuasive``) are valid catalog ids."""
    key_messages: list[str] | None = Field(default=None, alias="keyMessages")
    """Key messages the presentation should convey."""
    duration_minutes: float | None = Field(default=None, alias="durationMinutes")
    """Target presentation duration in minutes."""
    tags: list[str] | None = None
    """Free-form labels used for categorization, search, and filtering.
    Lowercase kebab-case is recommended for consistency."""


# ─── Design System ───────────────────────────────────────────────────


class OPFColorScheme(_OPFBase):
    """Color palette used by the design system.

    Slot fields (``accent1``\u2013``accent6``, ``dark1``/``dark2``,
    ``light1``/``light2``, ``hyperlink``, ``followedHyperlink``) mirror
    color-scheme.schema.json (https://pptx.dev/schema/opf-color-scheme/v1)
    so library records and inline OPF overrides are interchangeable on
    those fields. ``scheme`` and the abstract roles (``primary``,
    ``secondary``, ``accent``, ``background``, ``surface``, ``text``,
    ``textSecondary``, ``custom``) are OPF-specific authoring conveniences
    with no counterpart in the catalog record schema.
    """

    scheme: str | None = None
    """Color scheme reference (OPF-specific). Resolves to the ``id`` of a
    ``colorSchemes`` catalog record."""
    accent1: str | None = None
    accent2: str | None = None
    accent3: str | None = None
    accent4: str | None = None
    accent5: str | None = None
    accent6: str | None = None
    dark1: str | None = None
    dark2: str | None = None
    light1: str | None = None
    light2: str | None = None
    hyperlink: str | None = None
    followed_hyperlink: str | None = Field(default=None, alias="followedHyperlink")
    primary: str | None = None
    secondary: str | None = None
    accent: str | None = None
    background: str | None = None
    surface: str | None = None
    text: str | None = None
    text_secondary: str | None = Field(default=None, alias="textSecondary")
    custom: dict[str, str] | None = None


class OPFFont(_OPFBase):
    family: str
    weight: int | None = None
    style: Literal["normal", "italic"] | None = None
    letter_spacing: float | None = Field(default=None, alias="letterSpacing")


class OPFFontScheme(_OPFBase):
    """Typography selections used by the design system.

    Pair fields (``major``, ``minor``) and refinement fields (``type``,
    ``app``, ``languageFamily``) mirror font-scheme.schema.json
    (https://pptx.dev/schema/opf-font-scheme/v1) so library records and
    inline OPF overrides are interchangeable on those fields. ``scheme``
    and the abstract role objects (``heading``, ``body``, ``accent``,
    ``code``) are OPF-specific authoring conveniences with no counterpart
    in the catalog record schema.
    """

    scheme: str | None = None
    """Font scheme reference (OPF-specific). Resolves to the ``id`` of a
    ``fontSchemes`` catalog record."""
    major: str | None = None
    minor: str | None = None
    type: Literal["sans-serif", "serif", "monospace"] | None = None
    app: Literal["PowerPoint", "Google Slides"] | None = None
    language_family: Literal["latin", "ea", "cs"] | None = Field(
        default=None, alias="languageFamily"
    )
    heading: OPFFont | None = None
    body: OPFFont | None = None
    accent: OPFFont | None = None
    code: OPFFont | None = None


class OPFDimensions(_OPFBase):
    preset: str | None = None
    width_inches: float | None = Field(default=None, alias="widthInches")
    height_inches: float | None = Field(default=None, alias="heightInches")


class OPFGradientStop(_OPFBase):
    color: str
    position: float


class OPFGradient(_OPFBase):
    angle: float
    stops: list[OPFGradientStop]


class OPFBackgroundImage(_OPFBase):
    src: str
    """Source for the background image. Accepts an HTTPS URL, data URI,
    relative path, or asset reference."""
    fit: Literal["cover", "contain", "tile"]


class OPFBackground(_OPFBase):
    type: Literal["solid", "gradient", "image", "pattern"]
    color: str | None = None
    gradient: OPFGradient | None = None
    image: OPFBackgroundImage | None = None
    opacity: float | None = None


class OPFPosition(_OPFBase):
    x: float | None = None
    y: float | None = None
    anchor: str | None = None


class OPFBrandWatermark(_OPFBase):
    src: str
    """Source for the watermark image. Accepts an HTTPS URL, data URI,
    relative path, or asset reference."""
    opacity: float | None = None


class OPFBrand(_OPFBase):
    """Visual brand assets surfaced across slides.

    Organization identity (name, primary logo) lives in
    ``meta.organizations``; this object only carries visual overrides and
    decorative marks. All logo / icon / wordmark fields are bare source
    strings — placement and sizing are determined by slide layouts, not
    by this object.

    The schema offers three asset types (logo, icon, wordmark) plus a
    decorative watermark, and for each, two themed variants (Light,
    Dark). The logo additionally supports a ``Stacked`` aspect
    (icon-over-wordmark, suited to vertical / square slots). Naming
    follows brand-asset-library convention:

    * ``*Light`` = light-colored variant (e.g., white SVG), intended for
      rendering on dark backgrounds.
    * ``*Dark`` = dark-colored variant (e.g., black SVG), intended for
      rendering on light backgrounds.
    * ``Stacked`` = vertical lockup (icon above wordmark); the unsuffixed
      forms are assumed to be horizontal lockups.
    * The unsuffixed field (``logo`` / ``icon`` / ``wordmark`` /
      ``watermark``) is the default fallback when no themed variant is
      needed.

    Engine resolution: on a dark slide background, prefer the ``*Light``
    variant; on a light slide background, prefer the ``*Dark`` variant;
    for vertical / square brand-mark slots, prefer the ``logoStacked*``
    family over the horizontal logo; otherwise fall back to the
    unsuffixed asset and (for the logo) ultimately to
    ``meta.organizations[primary].logo``.
    """

    logo: str | None = None
    """Default full-lockup logo. Optional override of
    ``meta.organizations[primary].logo``."""
    logo_light: str | None = Field(default=None, alias="logoLight")
    """Light-colored logo variant for dark backgrounds."""
    logo_dark: str | None = Field(default=None, alias="logoDark")
    """Dark-colored logo variant for light backgrounds."""
    logo_stacked: str | None = Field(default=None, alias="logoStacked")
    """Stacked (vertical) lockup with the icon above the wordmark."""
    logo_stacked_light: str | None = Field(default=None, alias="logoStackedLight")
    """Light-colored stacked logo variant for dark backgrounds."""
    logo_stacked_dark: str | None = Field(default=None, alias="logoStackedDark")
    """Dark-colored stacked logo variant for light backgrounds."""
    icon: str | None = None
    """Default icon / mark / symbol (no wordmark)."""
    icon_light: str | None = Field(default=None, alias="iconLight")
    """Light-colored icon variant for dark backgrounds."""
    icon_dark: str | None = Field(default=None, alias="iconDark")
    """Dark-colored icon variant for light backgrounds."""
    wordmark: str | None = None
    """Default wordmark — company name in branded typography, no icon."""
    wordmark_light: str | None = Field(default=None, alias="wordmarkLight")
    """Light-colored wordmark variant for dark backgrounds."""
    wordmark_dark: str | None = Field(default=None, alias="wordmarkDark")
    """Dark-colored wordmark variant for light backgrounds."""
    watermark: OPFBrandWatermark | None = None
    """Default decorative watermark applied across slides."""
    watermark_light: OPFBrandWatermark | None = Field(
        default=None, alias="watermarkLight"
    )
    """Light-colored watermark variant for dark backgrounds."""
    watermark_dark: OPFBrandWatermark | None = Field(
        default=None, alias="watermarkDark"
    )
    """Dark-colored watermark variant for light backgrounds."""


class OPFLayoutPreferences(_OPFBase):
    density: str | None = None
    alignment: str | None = None
    animations: bool | None = None
    slide_numbers: bool | None = Field(default=None, alias="slideNumbers")


class OPFDesign(_OPFBase):
    theme: str | None = None
    """Theme reference. Resolves to the ``id`` of a ``themes`` catalog
    record (default catalog at https://www.pptx.gallery/themes)."""
    colors: Union[str, OPFColorScheme] | None = None
    """Color palette. String shorthand (catalog id, URL, or ``pkg:``
    reference) for the common case; object form for the ``scheme`` ref
    plus slot/role overrides."""
    fonts: Union[str, OPFFontScheme] | None = None
    """Typography. String shorthand (catalog id, URL, or ``pkg:``
    reference) for the common case; object form for the ``scheme`` ref
    plus pair/role overrides."""
    dimensions: OPFDimensions | None = None
    background: OPFBackground | None = None
    brand: OPFBrand | None = None
    layout_preferences: OPFLayoutPreferences | None = Field(
        default=None, alias="layoutPreferences"
    )


# ─── Elements ────────────────────────────────────────────────────────


class OPFSize(_OPFBase):
    width: float | None = None
    height: float | None = None
    unit: Literal["in", "%", "px"] | None = None


class OPFAnimation(_OPFBase):
    type: Literal["appear", "fadeIn", "slideIn", "zoomIn", "typewriter", "custom"]
    delay: float | None = None
    duration: float | None = None
    order: int | None = None


class OPFTextRun(_OPFBase):
    text: str
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    strikethrough: bool | None = None
    color: str | None = None
    font_size: float | None = Field(default=None, alias="fontSize")
    font_family: str | None = Field(default=None, alias="fontFamily")
    link: str | None = None
    superscript: bool | None = None
    subscript: bool | None = None


class OPFTextContent(_OPFBase):
    text: str | None = None
    runs: list[OPFTextRun] | None = None
    markdown: str | None = None
    bullets: list[Union[str, "OPFTextContent"]] | None = None
    numbered: list[Union[str, "OPFTextContent"]] | None = None


class OPFTextStyle(_OPFBase):
    font_size: float | None = Field(default=None, alias="fontSize")
    font_family: str | None = Field(default=None, alias="fontFamily")
    color: str | None = None
    alignment: Literal["left", "center", "right", "justify"] | None = None
    line_height: float | None = Field(default=None, alias="lineHeight")
    letter_spacing: float | None = Field(default=None, alias="letterSpacing")
    text_transform: (
        Literal["none", "uppercase", "lowercase", "capitalize"] | None
    ) = Field(default=None, alias="textTransform")
    vertical_alignment: Literal["top", "middle", "bottom"] | None = Field(
        default=None, alias="verticalAlignment"
    )


class _OPFElementBase(_OPFBase):
    id: str
    position: OPFPosition | None = None
    size: OPFSize | None = None
    animation: OPFAnimation | None = None
    slot: str | None = None


class OPFTextElement(_OPFElementBase):
    type: Literal["text"] = "text"
    content: OPFTextContent
    style: OPFTextStyle | None = None


class OPFImageElement(_OPFElementBase):
    type: Literal["image"] = "image"
    src: str
    alt: str | None = None
    fit: Literal["cover", "contain", "fill", "none"] | None = None
    border_radius: float | None = Field(default=None, alias="borderRadius")
    shadow: bool | None = None
    caption: str | None = None


class OPFShapeStroke(_OPFBase):
    color: str
    width: float


class OPFShapeElement(_OPFElementBase):
    type: Literal["shape"] = "shape"
    shape: Literal[
        "rectangle",
        "circle",
        "ellipse",
        "triangle",
        "arrow",
        "line",
        "star",
        "callout",
        "custom",
    ]
    fill: str | None = None
    stroke: OPFShapeStroke | None = None
    corner_radius: float | None = Field(default=None, alias="cornerRadius")
    text: OPFTextContent | None = None
    path: str | None = None


class OPFChartDataset(_OPFBase):
    label: str
    values: list[float]
    color: str | None = None
    type: str | None = None


class OPFChartData(_OPFBase):
    labels: list[str] | None = None
    datasets: list[OPFChartDataset]


class OPFChartAxis(_OPFBase):
    label: str | None = None
    min: float | None = None
    max: float | None = None
    format: str | None = None


class OPFChartLegend(_OPFBase):
    position: Literal["top", "bottom", "left", "right"]


class OPFChartOptions(_OPFBase):
    title: str | None = None
    legend: Union[bool, OPFChartLegend] | None = None
    show_values: bool | None = Field(default=None, alias="showValues")
    show_grid: bool | None = Field(default=None, alias="showGrid")
    stacked: bool | None = None
    y_axis: OPFChartAxis | None = Field(default=None, alias="yAxis")
    x_axis: OPFChartAxis | None = Field(default=None, alias="xAxis")


class OPFChartElement(_OPFElementBase):
    type: Literal["chart"] = "chart"
    chart_type: str | None = Field(default=None, alias="chartType")
    """Generic chart variant. Engine-agnostic alternative to
    ``chartPreset``. Accepts a generic type (``bar``, ``column``, ``line``,
    ``pie``, ``donut``, ``area``, ``scatter``, ``radar``, ``waterfall``,
    ``funnel``, ``treemap``, ``combo``) or any chart-preset id."""
    chart_preset: str | None = Field(default=None, alias="chartPreset")
    """Chart preset reference. Resolves to the ``id`` of a ``charts``
    catalog record (default catalog at https://www.pptx.gallery/charts).
    At least one of ``chartType`` or ``chartPreset`` must be set."""
    data: OPFChartData
    options: OPFChartOptions | None = None


class OPFTableStyle(_OPFBase):
    header_background: str | None = Field(default=None, alias="headerBackground")
    header_color: str | None = Field(default=None, alias="headerColor")
    striped_rows: bool | None = Field(default=None, alias="stripedRows")
    border_color: str | None = Field(default=None, alias="borderColor")
    compact: bool | None = None


class OPFTableElement(_OPFElementBase):
    type: Literal["table"] = "table"
    headers: list[str] | None = None
    rows: list[list[Any]]
    style: OPFTableStyle | None = None


class OPFVideoElement(_OPFElementBase):
    type: Literal["video"] = "video"
    src: str
    poster: str | None = None
    autoplay: bool | None = None


class OPFCodeElement(_OPFElementBase):
    type: Literal["code"] = "code"
    code: str
    language: str | None = None
    theme: Literal["dark", "light"] | None = None
    show_line_numbers: bool | None = Field(default=None, alias="showLineNumbers")


class OPFPlaceholderElement(_OPFElementBase):
    type: Literal["placeholder"] = "placeholder"
    prompt: str
    expected_type: Literal["text", "image", "chart", "table"] | None = Field(
        default=None, alias="expectedType"
    )


class OPFGroupElement(_OPFElementBase):
    type: Literal["group"] = "group"
    children: list["OPFElement"]


OPFElement = Annotated[
    Union[
        OPFTextElement,
        OPFImageElement,
        OPFShapeElement,
        OPFChartElement,
        OPFTableElement,
        OPFVideoElement,
        OPFCodeElement,
        OPFGroupElement,
        OPFPlaceholderElement,
    ],
    Field(discriminator="type"),
]


# ─── Slide & Document ────────────────────────────────────────────────


class OPFTransition(_OPFBase):
    type: Literal["none", "fade", "slide", "push", "wipe", "morph", "zoom"]
    duration: float | None = None
    direction: Literal["left", "right", "up", "down"] | None = None


class OPFSlide(_OPFBase):
    id: str
    layout: str
    design_overrides: OPFDesign | None = Field(default=None, alias="designOverrides")
    elements: list[OPFElement]
    notes: str | None = None
    transition: OPFTransition | None = None
    hidden: bool | None = None
    section: str | None = None
    beat: str | list[str] | None = None
    """Optional reference to one or more narrative beats (each value matches
    an ``id`` from ``meta.narrative.beats`` or the resolved template). A
    single string declares the slide's primary beat; a list declares that
    one slide covers multiple beats — useful when shorter decks fold beats
    together (e.g. ``["problem", "why-now"]``). Slides without a beat are
    valid; multiple slides may share a beat."""


class OPFDocument(_OPFBase):
    schema_url: Literal["https://pptx.dev/schema/opf/v1"] = Field(
        default="https://pptx.dev/schema/opf/v1",
        alias="$schema",
    )
    meta: OPFMeta
    design: OPFDesign
    slides: list[OPFSlide]
    extensions: dict[str, Any] | None = None


OPFTextContent.model_rebuild()
OPFGroupElement.model_rebuild()
OPFSlide.model_rebuild()
OPFOrganization.model_rebuild()
OPFSpeaker.model_rebuild()
OPFMeta.model_rebuild()
OPFDocument.model_rebuild()


__all__ = [
    "OPFAnimation",
    "OPFBackground",
    "OPFBackgroundImage",
    "OPFBrand",
    "OPFBrandWatermark",
    "OPFChartAxis",
    "OPFChartData",
    "OPFChartDataset",
    "OPFChartElement",
    "OPFChartLegend",
    "OPFChartOptions",
    "OPFCodeElement",
    "OPFColorScheme",
    "OPFDesign",
    "OPFDimensions",
    "OPFDocument",
    "OPFElement",
    "OPFFont",
    "OPFFontScheme",
    "OPFGradient",
    "OPFGradientStop",
    "OPFGroupElement",
    "OPFImageElement",
    "OPFLayoutPreferences",
    "OPFMeta",
    "OPFNarrative",
    "OPFNarrativeBeat",
    "OPFNarrativeDurationRange",
    "OPFNarrativePreview",
    "OPFOrganization",
    "OPFPlaceholderElement",
    "OPFPosition",
    "OPFShapeElement",
    "OPFShapeStroke",
    "OPFSize",
    "OPFSlide",
    "OPFSocials",
    "OPFSpeaker",
    "OPFTableElement",
    "OPFTableStyle",
    "OPFTextContent",
    "OPFTextElement",
    "OPFTextRun",
    "OPFTextStyle",
    "OPFTransition",
    "OPFVideoElement",
]
