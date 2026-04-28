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

    Slides reference beats via ``OPFSlide.beat``.
    """

    id: str
    name: str
    description: str | None = None
    slide_count: int | None = Field(default=None, alias="slideCount")
    """Optional explicit slide count for this beat. Defaults to 1 when
    omitted; values >1 are reserved for beats that intentionally span
    multiple slides. Prefer decomposing a heavy beat into multiple beats
    over setting a high ``slideCount``."""
    layout_hint: str | None = Field(default=None, alias="layoutHint")


class OPFNarrative(_OPFBase):
    """Structured storyline metadata used by AI to shape generated content.

    Narrative declares the deck's intended story arc; slides may opt into
    beats via ``OPFSlide.beat``. The narrative does not constrain slide
    structure — validators warn on drift but never error. Slides are the
    source of truth; narrative is intent that travels with the deck.
    """

    template: str | None = None
    description: str | None = None
    key_messages: list[str] | None = Field(default=None, alias="keyMessages")
    tone: str | None = None
    duration_minutes: float | None = Field(default=None, alias="durationMinutes")
    beats: list[OPFNarrativeBeat] | None = None


class OPFMeta(_OPFBase):
    title: str
    description: str | None = None
    filename: str | None = None
    subtitle: str | None = None
    author: str | None = None
    company: str | None = None
    audience: str | None = None
    purpose: str | None = None
    narrative: OPFNarrative | None = None
    language: str | None = None
    created_at: str | None = Field(default=None, alias="createdAt")
    tags: list[str] | None = None


# ─── Design System ───────────────────────────────────────────────────


class OPFColorScheme(_OPFBase):
    scheme: str | None = None
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
    scheme: str | None = None
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
    url: str
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


class OPFBrandLogo(_OPFBase):
    url: str
    position: OPFPosition | None = None
    width_inches: float | None = Field(default=None, alias="widthInches")


class OPFBrandWatermark(_OPFBase):
    url: str
    opacity: float | None = None


class OPFBrand(_OPFBase):
    logo: OPFBrandLogo | None = None
    watermark: OPFBrandWatermark | None = None
    company_name: str | None = Field(default=None, alias="companyName")


class OPFLayoutPreferences(_OPFBase):
    density: str | None = None
    alignment: str | None = None
    animations: bool | None = None
    slide_numbers: bool | None = Field(default=None, alias="slideNumbers")


class OPFDesign(_OPFBase):
    theme: str | None = None
    colors: OPFColorScheme | None = None
    fonts: OPFFontScheme | None = None
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
    chart_type: Literal[
        "bar",
        "column",
        "line",
        "pie",
        "donut",
        "area",
        "scatter",
        "radar",
        "waterfall",
        "funnel",
        "treemap",
        "combo",
    ] = Field(alias="chartType")
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
OPFDocument.model_rebuild()


__all__ = [
    "OPFAnimation",
    "OPFBackground",
    "OPFBackgroundImage",
    "OPFBrand",
    "OPFBrandLogo",
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
    "OPFPlaceholderElement",
    "OPFPosition",
    "OPFShapeElement",
    "OPFShapeStroke",
    "OPFSize",
    "OPFSlide",
    "OPFTableElement",
    "OPFTableStyle",
    "OPFTextContent",
    "OPFTextElement",
    "OPFTextRun",
    "OPFTextStyle",
    "OPFTransition",
    "OPFVideoElement",
]
