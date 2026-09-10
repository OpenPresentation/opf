// src/generated/schemas.ts
var presentation = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf/v1",
  "title": "Presentation",
  "description": "Open-source JSON format for describing PowerPoint presentations. Agents describe narratives, content, audience, reusable assets, and design \u2014 the engine handles OOXML complexity.\n\nFields that reference catalog records (narrative, language, tone, audience, purpose, design.theme / design.theme.id, design.colorScheme / design.colorScheme.id, design.fontScheme / design.fontScheme.id, Slide.layout, Chart.type, Organization.socials / Speaker.socials) resolve through the catalog system: inline 'catalogs.<kind>.records[]' on the document \u2192 'catalogs.<kind>.source' on the document \u2192 engine defaults \u2192 the default catalog at https://www.pptx.gallery/<kind>. Every reference resolves to the catalog record's 'id' field. When an OPF document omits a reference entirely, the engine falls back to engine defaults (see /spec/reference/engine-defaults.json for a reference example). The defaults file is engine configuration; it is not part of the OPF document contract and has no JSON Schema.\n\nMost catalog references accept the bare 'id' as a string for the common case (e.g. narrative = 'classic-story', design.colorScheme = 'cool-horizon'). Audience, purpose, tone, design, and language object forms use 'id' as a base catalog reference plus inline overrides. Asset references use 'asset:<id>' strings that point into the top-level assets registry.",
  "type": "object",
  "required": [
    "slides"
  ],
  "additionalProperties": false,
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf/v1",
      "description": "Optional OPF schema version. When omitted, validators and engines should assume the latest supported OPF schema."
    },
    "name": {
      "type": "string",
      "description": "Display name of the presentation for GUI/TUI lists, library/search indexing, OS-level metadata, and default export filenames. This is deck identity, not slide content. Use slides[].title and slides[].subtitle for text that should appear on presented slides.",
      "examples": [
        "Q4 2026 Business Review",
        "Series B Pitch \u2014 Acme",
        "The Future of Agentic Workflows"
      ]
    },
    "description": {
      "type": "string",
      "description": "Free-form prose describing what this presentation is about. Used by agents and humans as a deck-level summary; complements purpose (the goal) and narrative (the structured storyline). Round-trips to OOXML 'docProps/core.xml' as '<dc:description>' (PowerPoint surfaces this as the 'Comments' field in File \u2192 Properties).",
      "examples": [
        "Quarterly business review covering revenue, product, and hiring milestones for the executive team."
      ]
    },
    "filename": {
      "type": "string",
      "description": "Optional base filename for exports (without extension). Engine strips a trailing .pptx, .pdf, .png, or .svg (case-insensitive) and appends the target format's extension. When omitted, the engine slugifies name when present. See /docs/opf for full validation rules.",
      "examples": [
        "q4-2026-business-review",
        "acme-series-b-pitch"
      ]
    },
    "organization": {
      "oneOf": [
        {
          "$ref": "#/$defs/Organization"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Organization"
          },
          "minItems": 1
        }
      ],
      "description": "Organization associated with the presentation, usually the presenting company. Array form supports hosts, partners, clients, and sponsors. The primary organization (declared via Organization.role or, if no role is set, the first item) drives default branding such as cover-slide logo."
    },
    "speaker": {
      "oneOf": [
        {
          "$ref": "#/$defs/Speaker"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/Speaker"
          },
          "minItems": 1
        }
      ],
      "description": "Person presenting the deck. Array form supports panels and multi-speaker decks. Used for cover slides, bio slides, footers, and panel attribution."
    },
    "author": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1
        }
      ],
      "description": "Optional credit for the person who authored or contributed to the deck, distinct from speaker. Array form supports multiple contributors. Round-trips to OOXML 'docProps/core.xml' as '<dc:creator>' (semicolon-joined when multiple) and seeds '<cp:lastModifiedBy>' on first write; subsequent edits in PowerPoint overwrite '<cp:lastModifiedBy>' with the editing user.",
      "examples": [
        "Bob Lee",
        [
          "Bob Lee",
          "Carla Diaz"
        ]
      ]
    },
    "audience": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "string"
              },
              {
                "$ref": "#/$defs/Audience"
              }
            ]
          },
          "minItems": 1
        }
      ],
      "description": "Intended audiences for the presentation. Accepts either:\n- A single string shorthand: free-form description ('Series B investors'), an audiences catalog id ('executives'), an HTTPS URL, or a 'pkg:' reference.\n- An array of string shorthands and/or inline Audience objects for custom audience metadata or catalog-backed overrides. Object form mirrors https://openpresentation.org/schema/opf-audience/v1 without '$schema'.\n\nResolution order for catalog ids and references: inline catalogs.audiences.records[] \u2192 catalogs.audiences.source \u2192 default catalog at https://www.pptx.gallery/audiences.",
      "examples": [
        "executives",
        "Biology Students and Wildlife Enthusiasts",
        [
          "executives"
        ],
        [
          "board",
          "c-suite"
        ],
        [
          "Series B investors",
          "https://acme.com/decks/audiences/acme-board.json"
        ],
        [
          {
            "id": "executives",
            "attentionBudgetMinutes": 20
          },
          {
            "name": "Regional Sales Leaders",
            "seniority": "director",
            "technicalFluency": "medium",
            "decisionPower": "advisory"
          }
        ]
      ]
    },
    "purpose": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/Purpose"
        }
      ],
      "description": "Primary goal of the presentation. Accepts either:\n- A string shorthand: free-form goal ('Raise a Series B round of $30M'), a purposes catalog id ('decide', 'align'), an HTTPS URL, or a 'pkg:' reference.\n- An inline Purpose object for custom purpose metadata or catalog-backed overrides. Object form mirrors https://openpresentation.org/schema/opf-purpose/v1 without '$schema'.\n\nResolution order for catalog ids and references: inline catalogs.purposes.records[] \u2192 catalogs.purposes.source \u2192 default catalog at https://www.pptx.gallery/purposes.",
      "examples": [
        "Raise a Series B round of $30M",
        "align",
        "educate",
        "https://acme.com/decks/purposes/fundraise.json",
        "pkg:@acme/decks/purposes/fundraise",
        {
          "id": "decide",
          "outcome": "Approve the Q4 hiring plan"
        },
        {
          "name": "Secure renewal",
          "outcome": "Customer signs a 12-month renewal"
        }
      ]
    },
    "language": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/Language"
        }
      ],
      "description": "Language for the presentation content. Accepts either:\n- A string shorthand: a BCP-47 language tag ('en-US', 'en-GB', 'ja-JP', 'fr'), a languages catalog id ('english', 'japanese'), an HTTPS URL, or a 'pkg:' reference.\n- An inline Language object for custom language metadata or catalog-backed overrides. Object form mirrors https://openpresentation.org/schema/opf-language/v1 without '$schema'.\n\nResolution order for catalog ids and references: inline catalogs.languages.records[] \u2192 catalogs.languages.source \u2192 default catalog at https://www.pptx.gallery/languages.",
      "examples": [
        "en-US",
        "en-GB",
        "es-MX",
        "ja-JP",
        "fr",
        "english",
        "japanese",
        "https://acme.com/decks/languages/en-acme.json",
        "pkg:@acme/decks/languages/en-acme",
        {
          "id": "english",
          "bcp47": "en-US",
          "fontScheme": "aptos",
          "googleFontScheme": "roboto"
        },
        {
          "bcp47": "ar-SA",
          "name": "Arabic (Saudi Arabia)",
          "direction": "rtl",
          "script": "Arab"
        }
      ]
    },
    "tone": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/Tone"
        }
      ],
      "description": "Desired tone for the presentation. Accepts either:\n- A string shorthand: a tones catalog id ('formal'), an HTTPS URL, or a 'pkg:' reference.\n- An inline Tone object for custom tone metadata or catalog-backed overrides. Object form mirrors https://openpresentation.org/schema/opf-tone/v1 without '$schema'.\n\nResolution order for catalog ids and references: inline catalogs.tones.records[] \u2192 catalogs.tones.source \u2192 default catalog at https://www.pptx.gallery/tones.",
      "examples": [
        "formal",
        "casual",
        "inspirational",
        "technical",
        "persuasive",
        "https://acme.com/decks/tones/acme-voice.json",
        "pkg:@acme/decks/tones/acme-voice",
        {
          "id": "formal",
          "voiceCues": [
            "Use precise, concise language."
          ]
        },
        {
          "name": "Founder direct",
          "voiceCues": [
            "Use first person sparingly.",
            "Make the ask concrete."
          ]
        }
      ]
    },
    "takeaway": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1
        }
      ],
      "description": "Audience-facing takeaway the presentation should leave behind. Array form supports multiple takeaways. Deck-level intent used by AI to seed and pressure-test slide content.",
      "examples": [
        "Agent latency is the new bottleneck for AI products.",
        [
          "Agent latency is the new bottleneck for AI products.",
          "Our runtime is 8x faster than the next-best option.",
          "Customers see ROI within the first quarter."
        ]
      ]
    },
    "duration": {
      "type": "integer",
      "minimum": 1,
      "description": "Target presentation duration, as an integer number of minutes. Used by AI to set pace and depth, and to compare against the resolved narrative's durationRange."
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels used for categorization, search, and filtering. Lowercase kebab-case is recommended for consistency across a deck library.",
      "examples": [
        [
          "qbr",
          "internal",
          "fy26-q4"
        ],
        [
          "pitch",
          "fundraising",
          "confidential"
        ]
      ]
    },
    "design": {
      "$ref": "#/$defs/Design",
      "description": "Optional design system covering theme, color scheme, font scheme, dimensions, background, logo, watermark, header, and footer applied to the deck. When omitted, engines use their default design configuration."
    },
    "narrative": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/Narrative"
        }
      ],
      "description": `Structured storyline describing the deck's arc and beats. Resolves to the 'id' of a 'narratives' catalog record.

Accepts two forms:
- String shorthand for the common case: 'narrative = "classic-story"'. Accepts a bare id (lowercase kebab-case), an HTTPS URL pointing at a record file, or a 'pkg:' reference to a locally-installed package.
- Object form for inline overrides or fully custom narratives: 'narrative = { id: "classic-story", beats: [...] }'. The object shape mirrors https://openpresentation.org/schema/opf-narrative/v1 (sans '$schema'), so a library record and an inline narrative are interchangeable.

Resolution order: inline catalogs.narratives.records[] \u2192 catalogs.narratives.source \u2192 default catalog at https://www.pptx.gallery/narratives. Unknown ids produce a validation warning, not an error.

Deck-level concerns that aren't part of the storyline (audience, tone, takeaway, duration) live as siblings on the presentation root rather than inside the narrative object.`,
      "examples": [
        "classic-story",
        "problem-solution",
        "scqa",
        "pitch-deck",
        {
          "id": "custom-pitch",
          "name": "Custom Pitch",
          "beats": [
            {
              "id": "hook",
              "name": "Hook"
            },
            {
              "id": "ask",
              "name": "Ask"
            }
          ]
        },
        "https://acme.com/decks/narratives/founder-pitch.json",
        "pkg:@acme/decks/narratives/founder-pitch"
      ]
    },
    "slides": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/Slide"
      },
      "minItems": 1,
      "description": "Ordered array of slides that make up the presentation."
    },
    "assets": {
      "$ref": "#/$defs/Assets",
      "description": "Optional reusable asset registry for images, data files, videos, documents, fonts, and other resources referenced elsewhere in the deck via 'asset:<id>' strings."
    },
    "catalogs": {
      "$ref": "#/$defs/Catalogs",
      "description": "Optional per-kind catalog overrides. Each kind may declare a non-default 'source' and/or inline 'records' that override or supplement the default catalog at https://www.pptx.gallery/<kind>. References elsewhere in the document (e.g. design.theme, narrative) resolve through this section before falling back to the default catalog."
    },
    "extensions": {
      "type": "object",
      "description": "Custom data passthrough for agent workflows; ignored by the engine but preserved across read/write round-trips."
    }
  },
  "$defs": {
    "Assets": {
      "type": "object",
      "description": "Reusable asset registry for resources used by slides, charts, metadata, and design. Keys are stable asset ids referenced elsewhere as 'asset:<id>'. Each asset can be a source string or an object with src plus optional metadata.",
      "propertyNames": {
        "pattern": "^[a-zA-Z0-9][a-zA-Z0-9._-]*$"
      },
      "additionalProperties": {
        "$ref": "#/$defs/Asset"
      },
      "examples": [
        {
          "acme-logo": "./assets/acme-logo.svg",
          "watermark": {
            "src": "./assets/watermark.png",
            "alt": "Acme watermark"
          },
          "revenue": {
            "src": "./data/revenue.csv",
            "format": "csv"
          }
        }
      ]
    },
    "Asset": {
      "description": `Reusable or inline resource. A string is shorthand for { "src": value }. Source strings accept 'asset:<id>' references, HTTPS URLs, data URIs, relative paths resolved against the OPF file location, or local filesystem paths. Use object form when metadata such as alt text, title, mediaType, or format matters.`,
      "oneOf": [
        {
          "type": "string",
          "examples": [
            "asset:acme-logo",
            "https://cdn.acme.com/image.png",
            "./assets/image.png",
            "data:image/png;base64,..."
          ]
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "src"
          ],
          "properties": {
            "src": {
              "type": "string",
              "description": "Resource source. Accepts an 'asset:<id>' reference, HTTPS URL, data URI, relative path resolved against the OPF file location, or local filesystem path.",
              "examples": [
                "asset:acme-logo",
                "./assets/logo.svg",
                "https://cdn.acme.com/logo.png",
                "data:image/svg+xml;base64,...",
                "/Users/alice/decks/data/revenue.csv"
              ]
            },
            "alt": {
              "type": "string",
              "description": "Alternative text for images and other visual assets."
            },
            "title": {
              "type": "string",
              "description": "Human-readable asset title for editors and asset pickers."
            },
            "description": {
              "type": "string",
              "description": "Optional notes about the asset's contents, provenance, or intended use."
            },
            "mediaType": {
              "type": "string",
              "description": "Optional MIME media type when it cannot be inferred from src.",
              "examples": [
                "image/svg+xml",
                "image/png",
                "text/csv",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              ]
            },
            "format": {
              "type": "string",
              "description": "Optional authoring/parsing format hint. Useful when format is more convenient than a full MIME media type.",
              "examples": [
                "csv",
                "tsv",
                "json",
                "xlsx",
                "svg",
                "png",
                "jpg",
                "webp"
              ]
            }
          }
        }
      ]
    },
    "Audience": {
      "type": "object",
      "description": "Inline audience metadata for the presentation. Use 'id' to reference an audiences catalog record and override selected fields, or use 'name' for a custom inline audience.",
      "anyOf": [
        {
          "required": [
            "id"
          ]
        },
        {
          "required": [
            "name"
          ]
        }
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Optional audiences catalog id to resolve before applying inline overrides.",
          "examples": [
            "executives",
            "board",
            "engineering-team"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable audience name shown in pickers."
        },
        "summary": {
          "type": "string",
          "description": "One-sentence positioning of the audience."
        },
        "description": {
          "type": "string",
          "description": "Longer prose describing the audience and how to address them."
        },
        "seniority": {
          "type": "string",
          "enum": [
            "ic",
            "manager",
            "director",
            "vp",
            "c-suite",
            "mixed"
          ],
          "description": "Typical seniority level of the audience."
        },
        "technicalFluency": {
          "type": "string",
          "enum": [
            "low",
            "medium",
            "high",
            "mixed"
          ],
          "description": "Typical technical fluency of the audience."
        },
        "decisionPower": {
          "type": "string",
          "enum": [
            "informational",
            "advisory",
            "decision-maker"
          ],
          "description": "Whether the audience is expected to be informed, advise, or decide."
        },
        "attentionBudgetMinutes": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Realistic upper bound on focused attention for a single presentation, in minutes."
        },
        "recommendedNarratives": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Soft cross-link: narrative-catalog ids that work well for this audience."
        },
        "recommendedTones": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Soft cross-link: tone-catalog ids that work well for this audience."
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Free-form labels for filtering and search."
        }
      }
    },
    "Purpose": {
      "type": "object",
      "description": "Inline purpose metadata for the presentation. Use 'id' to reference a purposes catalog record and override selected fields, or use 'name' for a custom inline purpose.",
      "anyOf": [
        {
          "required": [
            "id"
          ]
        },
        {
          "required": [
            "name"
          ]
        }
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Optional purposes catalog id to resolve before applying inline overrides.",
          "examples": [
            "inform",
            "decide",
            "align",
            "persuade",
            "educate"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable purpose name shown in pickers."
        },
        "summary": {
          "type": "string",
          "description": "One-sentence positioning of the purpose."
        },
        "description": {
          "type": "string",
          "description": "Longer prose describing when to use this purpose and how it should shape a deck."
        },
        "outcome": {
          "type": "string",
          "description": "Desired audience outcome after the presentation."
        },
        "successCriteria": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Observable signals that the deck accomplished this purpose."
        },
        "recommendedNarratives": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Soft cross-link: narrative-catalog ids that work well for this purpose."
        },
        "recommendedTones": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Soft cross-link: tone-catalog ids that work well for this purpose."
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Free-form labels for filtering and search."
        }
      }
    },
    "Language": {
      "type": "object",
      "description": "Inline language metadata for the presentation. Use 'id' to reference a languages catalog record and override selected fields, or use 'bcp47' for a custom language tag without a catalog record.",
      "anyOf": [
        {
          "required": [
            "id"
          ]
        },
        {
          "required": [
            "bcp47"
          ]
        }
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Optional languages catalog id to resolve before applying inline overrides.",
          "examples": [
            "english",
            "japanese",
            "chinese-simplified",
            "english-uk"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable language name.",
          "examples": [
            "English",
            "English (United Kingdom)",
            "Arabic (Saudi Arabia)"
          ]
        },
        "bcp47": {
          "type": "string",
          "description": "BCP-47 language tag used for locale-aware rendering, proofing, and accessibility metadata. Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region form.",
          "examples": [
            "en",
            "en-US",
            "en-GB",
            "ar-SA",
            "zh-Hans"
          ]
        },
        "code": {
          "type": "string",
          "description": "ISO 639-3 or 639-2 language code carried for engines that prefer ISO codes.",
          "examples": [
            "ENG",
            "ARA",
            "JPN",
            "ZHO"
          ]
        },
        "direction": {
          "type": "string",
          "enum": [
            "ltr",
            "rtl"
          ],
          "description": "Base text direction for the language."
        },
        "script": {
          "type": "string",
          "description": "ISO 15924 script code when the writing system should be explicit.",
          "examples": [
            "Latn",
            "Arab",
            "Cyrl",
            "Hans",
            "Hant"
          ]
        },
        "fontScheme": {
          "type": "string",
          "description": "Default font-scheme id for this language when targeting PowerPoint output."
        },
        "googleFontScheme": {
          "type": "string",
          "description": "Default font-scheme id for this language when targeting Google Slides output."
        },
        "summary": {
          "type": "string",
          "description": "One-sentence note about coverage or font defaults."
        },
        "description": {
          "type": "string",
          "description": "Longer prose describing the language record and any font-pairing rationale."
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Free-form labels for filtering and search."
        }
      }
    },
    "Tone": {
      "type": "object",
      "description": "Inline tone metadata for the presentation. Use 'id' to reference a tones catalog record and override selected fields, or use 'name' for a custom inline tone.",
      "anyOf": [
        {
          "required": [
            "id"
          ]
        },
        {
          "required": [
            "name"
          ]
        }
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Optional tones catalog id to resolve before applying inline overrides.",
          "examples": [
            "formal",
            "casual",
            "technical",
            "persuasive"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable tone name shown in pickers."
        },
        "summary": {
          "type": "string",
          "description": "One-sentence positioning of the tone."
        },
        "description": {
          "type": "string",
          "description": "Longer prose describing the tone and the kinds of decks it suits."
        },
        "voiceCues": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Short directives that shape AI generation toward this tone."
        },
        "avoid": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Anti-patterns that AI generation should not produce when this tone is active."
        },
        "samplePhrases": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Short example phrases that exemplify this tone."
        },
        "recommendedNarratives": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Soft cross-link: narrative-catalog ids this tone pairs well with."
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Free-form labels for filtering and search."
        }
      }
    },
    "Organization": {
      "type": "object",
      "description": "An organization associated with the presentation \u2014 typically the presenting company, but also hosts, partners, clients, or sponsors. Surfaced on cover slides, footers, and brand bars; the primary organization's logo is the default deck logo unless overridden by design.logo.",
      "required": [
        "id",
        "name"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+$",
          "description": "Stable identifier for the organization, used to reference it from Speaker.organizationId. Must be unique within the deck.",
          "examples": [
            "acme",
            "acme-corp",
            "devconf-2026"
          ]
        },
        "name": {
          "type": "string",
          "description": "Display name shown on slides.",
          "examples": [
            "Acme Corp",
            "DevConf 2026",
            "Beta Industries"
          ]
        },
        "legalName": {
          "type": "string",
          "description": "Optional legal entity name when it differs from the display name.",
          "examples": [
            "Acme Corporation, Inc.",
            "Beta Industries, LLC"
          ]
        },
        "logo": {
          "$ref": "#/$defs/Asset",
          "description": "Source for the organization's logo image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are SVG (preferred for vector logos), PNG (with transparency), or JPG. The primary organization's logo is used by default for cover-slide and footer branding; design.logo overrides the source.",
          "examples": [
            "https://cdn.acme.com/logo.svg",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=",
            "./assets/logo.jpg",
            "asset:acme-logo"
          ]
        },
        "domain": {
          "type": "string",
          "description": "Bare internet domain for the organization. Used for footers, contact slides, and engine-driven asset lookups (e.g., favicon-based brand defaults).",
          "examples": [
            "acme.com",
            "beta-industries.io",
            "devconf.org"
          ]
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "General contact email for the organization. Used on contact slides and footer attribution.",
          "examples": [
            "hello@acme.com",
            "sales@acme.com",
            "info@beta-industries.io"
          ]
        },
        "phone": {
          "type": "string",
          "description": "Main contact phone number for the organization. E.164 format is recommended.",
          "examples": [
            "+14155551234",
            "+442071838750"
          ]
        },
        "tagline": {
          "type": "string",
          "description": "Short tagline rendered alongside the organization name on cover slides.",
          "examples": [
            "Build the future of work",
            "Infrastructure for AI agents",
            "Where teams ship faster"
          ]
        },
        "role": {
          "type": "string",
          "enum": [
            "primary",
            "partner",
            "client",
            "sponsor",
            "host"
          ],
          "description": "Role of the organization relative to the presentation. When omitted, the single organization or first organization in array form is treated as primary."
        },
        "socials": {
          "$ref": "#/$defs/Socials",
          "description": "Optional social media handles or URLs for the organization."
        }
      }
    },
    "Speaker": {
      "type": "object",
      "description": "A person presenting the deck. Used for cover slides, bio/intro slides, footer attribution, and panel formats with multiple presenters.",
      "required": [
        "id",
        "name"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+$",
          "description": "Stable identifier for the speaker, used for cross-references within the deck. Must be unique within the deck.",
          "examples": [
            "alice",
            "alice-chen",
            "speaker-1"
          ]
        },
        "name": {
          "type": "string",
          "description": "Display name.",
          "examples": [
            "Alice Chen",
            "Bob Lee",
            "Dr. Carla Diaz"
          ]
        },
        "title": {
          "type": "string",
          "description": "Role or title. Often paired with the speaker's organization on cover slides.",
          "examples": [
            "VP of Engineering",
            "Founder & CEO",
            "Chief Product Officer",
            "Senior Staff Engineer"
          ]
        },
        "photo": {
          "$ref": "#/$defs/Asset",
          "description": "Source for the speaker's headshot image. Accepts an HTTPS URL, data URI, relative path (resolved against the OPF file location), local path, or 'asset:<id>' reference. Common formats are JPG or PNG; SVG is not appropriate for photographic content. Used on cover and bio slides.",
          "examples": [
            "https://cdn.acme.com/headshots/alice.jpg",
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ//2Q==",
            "./assets/photos/alice.png",
            "asset:photo-alice"
          ]
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "Contact email, used on contact slides or footer attribution when appropriate.",
          "examples": [
            "alice@acme.com",
            "alice.chen@acme.com"
          ]
        },
        "phone": {
          "type": "string",
          "description": "Contact phone number for the speaker. E.164 format is recommended.",
          "examples": [
            "+14155551234",
            "+442071838750"
          ]
        },
        "bio": {
          "type": "string",
          "description": "Short biographical paragraph for bio or 'about the speaker' slides.",
          "examples": [
            "Alice leads engineering at Acme, where she's spent the last six years scaling distributed systems from prototype to billions of requests per day. Previously, she was a staff engineer at Google."
          ]
        },
        "organizationId": {
          "type": "string",
          "description": "Reference to an Organization.id in organization. Lets a speaker be attributed to their org in panel or multi-org decks without repeating organization details.",
          "examples": [
            "acme",
            "beta",
            "devconf-2026"
          ]
        },
        "socials": {
          "$ref": "#/$defs/Socials",
          "description": "Optional social media handles or URLs for the speaker."
        }
      }
    },
    "Socials": {
      "type": "object",
      "description": "Social media handles or URLs, keyed by platform id from the 'socialPlatforms' catalog. Each value is a string \u2014 either a full URL or a platform handle (e.g., '@acme'). The catalog record for each platform carries the URL pattern, handle prefix, brand color, and themed icons used by renderers.\n\nKeys resolve to the 'id' of a 'socialPlatforms' catalog record. Resolution order: inline catalogs.socialPlatforms.records[] \u2192 catalogs.socialPlatforms.source \u2192 default catalog at https://www.pptx.gallery/social-platforms. Unknown platform keys render with engine fallbacks (the raw value as text). Used both for organization and speaker records.",
      "additionalProperties": {
        "type": "string",
        "description": "Handle or URL for the platform identified by the property key."
      },
      "examples": [
        {
          "linkedin": "https://linkedin.com/in/alice-chen",
          "x": "@alicechen",
          "github": "alicechen"
        },
        {
          "linkedin": "https://linkedin.com/company/acme",
          "bluesky": "acme.bsky.social",
          "mastodon": "https://hachyderm.io/@acme"
        }
      ],
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9-]*$",
        "description": "Platform id (lowercase kebab-case). Common ids include 'linkedin', 'x', 'github', 'youtube', 'instagram', 'facebook', 'tiktok', 'threads', 'mastodon', 'bluesky'."
      }
    },
    "Narrative": {
      "type": "object",
      "description": "Structured storyline used by AI to shape generated content. Mirrors the OPF Narrative Template record at https://openpresentation.org/schema/opf-narrative/v1 (sans '$schema'), so a library record and an inline narrative are interchangeable.\n\nNarrative declares the deck's intended story arc; slides may opt into beats via Slide.beat. The narrative does not constrain slide structure \u2014 validators warn on drift (orphan slides, unused beats) but never error. Slides are the source of truth; narrative is intent that travels with the deck.\n\nWhen 'id' matches a record in the resolved 'narratives' catalog, the inline fields override matching fields on the catalog record (beats merge by beat 'id'). When 'id' doesn't match, this object defines a fully custom inline narrative.\n\nDeck-level concerns that aren't part of the storyline (audience, tone, takeaway, duration) live as siblings on the presentation root rather than inside this object.",
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Stable slug identifying this narrative. When it matches a record in the resolved 'narratives' catalog, the catalog record's beats and metadata seed this narrative; inline fields override per-key. When it doesn't match, this is a fully custom inline narrative. Lowercase kebab-case.",
          "examples": [
            "classic-story",
            "problem-solution",
            "scqa",
            "pitch-deck",
            "qbr",
            "weekly-progress",
            "custom-pitch"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable narrative name.",
          "examples": [
            "Classic Story",
            "Problem \u2192 Solution",
            "SCQA",
            "Founder Pitch"
          ]
        },
        "summary": {
          "type": "string",
          "description": "One-sentence description of when and why to use this narrative."
        },
        "description": {
          "type": "string",
          "description": "Longer prose describing the narrative arc and ideal use cases. Used by AI-driven generation to seed deck-level direction.",
          "examples": [
            "Open with the cost of slow agentic workflows, contrast with what becomes possible at sub-second latency, then walk through our architecture and benchmark results, ending with a concrete adoption ask."
          ]
        },
        "audienceFit": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Audiences this narrative works well for. Free-form strings or 'audiences' catalog ids.",
          "examples": [
            [
              "executives",
              "investors",
              "customers"
            ]
          ]
        },
        "durationRange": {
          "type": "object",
          "description": "Typical talk-length window this narrative suits. Compared by validators against duration.",
          "properties": {
            "minMinutes": {
              "type": "number",
              "exclusiveMinimum": 0
            },
            "maxMinutes": {
              "type": "number",
              "exclusiveMinimum": 0
            }
          }
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Free-form labels for filtering and search.",
          "examples": [
            [
              "business",
              "pitch",
              "internal"
            ]
          ]
        },
        "preview": {
          "type": "object",
          "description": "Visual previews of the narrative, used by picker UIs and inline rendering. All sub-fields are optional.",
          "properties": {
            "src": {
              "type": "string",
              "format": "uri",
              "description": "Main preview image (PNG/JPG)."
            },
            "thumbnailSrc": {
              "type": "string",
              "format": "uri",
              "description": "Smaller thumbnail preview for dense grid views."
            },
            "vectorSrc": {
              "type": "string",
              "format": "uri",
              "description": "SVG / vector preview for crisp scaling at any size."
            }
          }
        },
        "beats": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/NarrativeBeat"
          },
          "description": "Ordered list of beats that make up the narrative arc. When 'id' matches a catalog record, beats here override or extend matching catalog beats by their own 'id'. Beat IDs must be unique within the narrative."
        }
      }
    },
    "NarrativeBeat": {
      "type": "object",
      "description": "A single narrative beat \u2014 a labeled segment of the story arc with a specific dramatic purpose (e.g. 'hook', 'problem', 'evidence', 'ask'). Slides reference beats via Slide.beat. Beats may also carry slide-blueprint hints (slideType, layoutHint, thoughtCues, instructions) that guide the assigned slide.\n\nMirrors the Beat definition in narrative.schema.json (https://openpresentation.org/schema/opf-narrative/v1) so library entries and inline OPF beats are interchangeable.",
      "required": [
        "id",
        "name"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Stable slug used by Slide.beat to reference this beat. Lowercase kebab-case.",
          "examples": [
            "hook",
            "problem",
            "evidence",
            "ask",
            "next-steps"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable beat name.",
          "examples": [
            "The Hook",
            "The Problem",
            "Why Now",
            "The Ask"
          ]
        },
        "description": {
          "type": "string",
          "description": "Curator-written prose that explains what this beat should accomplish.",
          "examples": [
            "Quantify the pain customers feel today, with one striking stat the audience can repeat afterward."
          ]
        },
        "instructions": {
          "type": "string",
          "description": "Short author-facing instruction for the beat \u2014 typically one phrase. Complements 'description' with a concise directive.",
          "examples": [
            "Capture audience attention",
            "Introduce problem",
            "Detail implementation",
            "Inspire & conclude"
          ]
        },
        "slideCount": {
          "type": "integer",
          "minimum": 1,
          "description": "Optional explicit slide count for this beat. Defaults to 1 when omitted; values >1 are reserved for beats that intentionally span multiple slides. Prefer decomposing a heavy beat into multiple beats over setting a high slideCount. The validator emits a warning if the deck's actual count differs significantly."
        },
        "slideType": {
          "type": "string",
          "enum": [
            "text",
            "list",
            "image",
            "chart",
            "table",
            "video",
            "code",
            "metric",
            "quote",
            "timeline"
          ],
          "description": "Default content kind for the beat's slide. Mirrors ContentPayload.type and helps engines choose a sensible layout when only the beat is specified."
        },
        "layoutHint": {
          "type": "string",
          "description": "Suggested layout id for the beat's opening slide. Resolves the same way as Slide.layout \u2014 against catalogs.layouts and the default catalog at https://www.pptx.gallery/layouts.",
          "examples": [
            "section-divider",
            "title-slide",
            "title-left",
            "two-column",
            "text-left"
          ]
        },
        "thoughtCues": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Optional speaker or thinking cues attached to the beat. Surfaced in presenter notes.",
          "examples": [
            [
              "What pain is the audience feeling right now?",
              "Why hasn't anyone solved this yet?"
            ]
          ]
        }
      }
    },
    "Design": {
      "type": "object",
      "description": "Visual design system applied to the presentation; individual slides may override fields via Slide.design.",
      "properties": {
        "theme": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/Theme"
            }
          ],
          "description": `Theme for the deck. Accepts two forms:
- String shorthand: 'design.theme = "minimal"'. Bare id, HTTPS URL, or 'pkg:' reference resolved as the 'id' of a 'themes' catalog record.
- Object form: a Theme with an optional 'id' base reference plus theme-level overrides.

Inline overrides on design.colorScheme / design.fontScheme / design.background / design.dimensions take precedence over the resolved theme.

Resolution order: inline catalogs.themes.records[] -> catalogs.themes.source -> default catalog at https://www.pptx.gallery/themes.`,
          "examples": [
            "minimal",
            "classic",
            "dark",
            "bold",
            "corporate-minimal",
            "ocean-depth",
            "https://acme.com/decks/themes/acme-brand.json",
            "pkg:@acme/decks/themes/acme-brand",
            {
              "id": "minimal",
              "background": "dark1",
              "dimensions": "widescreen"
            }
          ]
        },
        "colorScheme": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/ColorScheme"
            }
          ],
          "description": `Color scheme for the presentation. Accepts two forms:
- String shorthand: 'design.colorScheme = "cool-horizon"'. Bare id, HTTPS URL, or 'pkg:' reference resolved as the 'id' of a 'colorSchemes' catalog record.
- Object form: a ColorScheme with an optional 'id' base reference plus slot/role overrides.

Resolution order: inline catalogs.colorSchemes.records[] -> catalogs.colorSchemes.source -> default catalog at https://www.pptx.gallery/color-schemes.`,
          "examples": [
            "cool-horizon",
            "boost",
            "burnt-orange",
            {
              "id": "cool-horizon",
              "accent1": "#FF6F61"
            }
          ]
        },
        "fontScheme": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/FontScheme"
            }
          ],
          "description": `Font scheme for heading, body, accent, and code text. Accepts two forms:
- String shorthand: 'design.fontScheme = "aptos"'. Bare id, HTTPS URL, or 'pkg:' reference resolved as the 'id' of a 'fontSchemes' catalog record.
- Object form: a FontScheme with an optional 'id' base reference plus pair/role overrides.

Resolution order: inline catalogs.fontSchemes.records[] -> catalogs.fontSchemes.source -> default catalog at https://www.pptx.gallery/font-schemes.`,
          "examples": [
            "aptos",
            "tenorite",
            {
              "id": "aptos",
              "heading": {
                "family": "Inter",
                "weight": 700
              }
            }
          ]
        },
        "dimensions": {
          "oneOf": [
            {
              "$ref": "#/$defs/DimensionPreset"
            },
            {
              "$ref": "#/$defs/Dimensions"
            }
          ],
          "description": "Slide dimensions and aspect ratio. String shorthand such as 'widescreen' is equivalent to { preset: 'widescreen' }.",
          "examples": [
            "widescreen",
            "16:9",
            {
              "preset": "16:10"
            }
          ]
        },
        "background": {
          "oneOf": [
            {
              "$ref": "#/$defs/BackgroundShortcut"
            },
            {
              "$ref": "#/$defs/Background"
            }
          ],
          "description": "Default slide background applied across the deck unless overridden on a slide. String shorthand accepts theme slots ('light1', 'light2', 'dark1', 'dark2') or hex colors; object forms support theme, solid, gradient, image, or pattern fills.",
          "examples": [
            "dark1",
            "#ffff00",
            {
              "type": "theme",
              "slot": "light1"
            }
          ]
        },
        "logo": {
          "oneOf": [
            {
              "$ref": "#/$defs/Asset"
            },
            {
              "$ref": "#/$defs/LogoSet"
            }
          ],
          "description": "Deck logo assets used by layouts, covers, section dividers, headers, and footers. A string is the default logo source; object form provides light/dark, stacked, icon, and wordmark variants. When omitted, the renderer falls back to the primary organization logo.",
          "examples": [
            "asset:acme-logo",
            {
              "default": "asset:acme-logo",
              "light": "asset:acme-logo-white",
              "icon": "asset:acme-icon"
            }
          ]
        },
        "watermark": {
          "oneOf": [
            {
              "type": "boolean",
              "const": false
            },
            {
              "$ref": "#/$defs/Asset"
            },
            {
              "$ref": "#/$defs/Watermark"
            }
          ],
          "description": "Optional decorative watermark applied across slides. Use false to suppress an inherited watermark in slide-level design; a string is equivalent to { src: value }.",
          "examples": [
            false,
            "asset:watermark",
            {
              "src": "asset:watermark",
              "opacity": 0.08
            }
          ]
        },
        "header": {
          "oneOf": [
            {
              "type": "boolean",
              "const": false
            },
            {
              "$ref": "#/$defs/HeaderFooter"
            }
          ],
          "description": "Repeated header furniture rendered outside the main slide content. Use false to suppress an inherited header.",
          "examples": [
            false,
            {
              "left": {
                "section": true
              },
              "right": {
                "image": "asset:acme-logo"
              }
            }
          ]
        },
        "footer": {
          "oneOf": [
            {
              "type": "boolean",
              "const": false
            },
            {
              "$ref": "#/$defs/HeaderFooter"
            }
          ],
          "description": "Repeated footer furniture rendered outside the main slide content. Use false to suppress an inherited footer.",
          "examples": [
            false,
            {
              "left": {
                "image": "asset:acme-logo"
              },
              "center": {
                "text": "Confidential"
              },
              "right": {
                "slideNumber": true
              }
            }
          ]
        },
        "titleAlignment": {
          "type": "string",
          "enum": [
            "left",
            "center",
            "right"
          ],
          "description": "Default horizontal alignment for title placeholders in resolved layouts."
        },
        "contentAlignment": {
          "type": "string",
          "enum": [
            "left",
            "center",
            "right"
          ],
          "description": "Default horizontal alignment for body/content regions in resolved layouts."
        },
        "contentBox": {
          "type": "boolean",
          "description": "Whether body/content regions are rendered inside a visible card or surface."
        },
        "slideImage": {
          "oneOf": [
            {
              "$ref": "#/$defs/Asset"
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "position"
              ],
              "properties": {
                "src": {
                  "type": "string",
                  "description": "Source for the slide-level image. When omitted in a design override, the object only configures how a slide-level image should be placed when one is supplied by a content payload, asset, or renderer convention."
                },
                "position": {
                  "type": "string",
                  "enum": [
                    "background",
                    "top",
                    "bottom",
                    "left",
                    "right"
                  ],
                  "description": "Where the slide-level image sits relative to the content. 'background' is a full-bleed image behind the content."
                }
              }
            }
          ],
          "description": "Optional slide-level image treatment used by layouts that support a decorative or editorial image separate from content images."
        },
        "contentDirection": {
          "type": "string",
          "enum": [
            "horizontal",
            "vertical"
          ],
          "description": "Axis along which parallel body/content regions are arranged."
        },
        "chartPrimary": {
          "type": "string",
          "enum": [
            "none",
            "top",
            "bottom",
            "left",
            "right"
          ],
          "description": "For chart layouts, where the primary chart sits relative to supporting content. 'none' means chart regions have equal weight."
        },
        "imageFill": {
          "type": "string",
          "enum": [
            "crop",
            "fit"
          ],
          "description": "How picture placeholders fill their allocated region."
        },
        "listBullet": {
          "type": "string",
          "enum": [
            "character",
            "image"
          ],
          "description": "Default bullet rendering style for list layouts."
        }
      }
    },
    "Theme": {
      "type": "object",
      "description": "Theme bundle used by the design system. In design.theme, 'id' resolves a themes catalog record as the base; any sibling fields override the resolved theme. The string shorthand on design.theme is equivalent to setting only 'id'.",
      "properties": {
        "id": {
          "type": "string",
          "description": "Theme reference. Resolves to the 'id' of a 'themes' catalog record. Accepts a bare id (lowercase kebab-case, e.g. 'minimal'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Field overrides on the surrounding Theme object take precedence over the resolved theme.\n\nResolution order: inline catalogs.themes.records[] -> catalogs.themes.source -> default catalog at https://www.pptx.gallery/themes.",
          "examples": [
            "minimal",
            "classic",
            "dark",
            "bold",
            "https://acme.com/decks/themes/acme-brand.json",
            "pkg:@acme/decks/themes/acme-brand"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable theme name shown in pickers.",
          "examples": [
            "Minimal",
            "Classic",
            "Dark",
            "Bold"
          ]
        },
        "summary": {
          "type": "string",
          "description": "One-sentence positioning of the theme - when to reach for it."
        },
        "description": {
          "type": "string",
          "description": "Longer prose describing what the theme looks and feels like and the kinds of decks it suits."
        },
        "colorScheme": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/ColorScheme"
            }
          ],
          "description": "Default color scheme for this theme. A string resolves against catalogs.colorSchemes; an object may provide an 'id' base reference plus overrides.",
          "examples": [
            "cool-horizon",
            {
              "id": "cool-horizon",
              "accent1": "#FF6F61"
            }
          ]
        },
        "fontScheme": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/FontScheme"
            }
          ],
          "description": "Default font scheme for this theme. A string resolves against catalogs.fontSchemes; an object may provide an 'id' base reference plus overrides.",
          "examples": [
            "aptos",
            {
              "id": "aptos",
              "heading": {
                "family": "Inter",
                "weight": 700
              }
            }
          ]
        },
        "background": {
          "oneOf": [
            {
              "$ref": "#/$defs/BackgroundShortcut"
            },
            {
              "$ref": "#/$defs/Background"
            }
          ],
          "description": "Default background for this theme. String shorthand accepts theme slots ('light1', 'light2', 'dark1', 'dark2') or hex colors.",
          "examples": [
            "dark1",
            "#ffff00",
            {
              "type": "theme",
              "slot": "dark2"
            }
          ]
        },
        "dimensions": {
          "oneOf": [
            {
              "$ref": "#/$defs/DimensionPreset"
            },
            {
              "$ref": "#/$defs/Dimensions"
            }
          ],
          "description": "Default slide size for this theme. A string preset is equivalent to { preset: value }.",
          "examples": [
            "widescreen",
            {
              "preset": "16:9"
            }
          ]
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Free-form labels for filtering and search."
        }
      }
    },
    "ColorScheme": {
      "type": "object",
      "description": "Color palette used by the design system. The slot fields (accent1-accent6, dark1, dark2, light1, light2, hyperlink, followedHyperlink) mirror color-scheme.schema.json (https://openpresentation.org/schema/opf-color-scheme/v1) so library records and inline OPF overrides are interchangeable on those fields.\n\nTwo parallel models are supported and may be mixed:\n- OOXML slots - the 12-slot PowerPoint theme model that round-trips directly to OOXML. Use these for full control over the palette as PowerPoint sees it.\n- Abstract roles (primary, secondary, accent, background, surface, text, textSecondary, custom) - OPF-specific semantic aliases the engine maps onto the OOXML slots. Convenient for inline overrides without thinking in slot numbers; not part of the catalog record schema.\n\nIn design.colorScheme, 'id' resolves a colorSchemes catalog record as the base; slot and role overrides on the same object take precedence over the resolved scheme. The string shorthand on design.colorScheme is equivalent to setting only 'id'.",
      "properties": {
        "id": {
          "type": "string",
          "description": "Color scheme reference. Resolves to the 'id' of a 'colorSchemes' catalog record. Accepts a bare id (lowercase kebab-case, e.g. 'cool-horizon'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Slot and role overrides on the surrounding ColorScheme object take precedence over the resolved scheme.\n\nResolution order: inline catalogs.colorSchemes.records[] -> catalogs.colorSchemes.source -> default catalog at https://www.pptx.gallery/color-schemes.",
          "examples": [
            "cool-horizon",
            "boost",
            "burnt-orange",
            "ocean-depth",
            "corporate-blue",
            "https://acme.com/decks/color-schemes/acme.json",
            "pkg:@acme/decks/color-schemes/acme"
          ]
        },
        "accent1": {
          "type": "string",
          "description": "Accent 1 color (hex). Mirrors the OOXML accent1 slot.",
          "examples": [
            "#2874A6",
            "#FD3223",
            "#F77F00"
          ]
        },
        "accent2": {
          "type": "string",
          "description": "Accent 2 color (hex). Mirrors the OOXML accent2 slot.",
          "examples": [
            "#1B4F72",
            "#0308DB",
            "#D62828"
          ]
        },
        "accent3": {
          "type": "string",
          "description": "Accent 3 color (hex). Mirrors the OOXML accent3 slot.",
          "examples": [
            "#5499C7",
            "#4F4955",
            "#003049"
          ]
        },
        "accent4": {
          "type": "string",
          "description": "Accent 4 color (hex). Mirrors the OOXML accent4 slot.",
          "examples": [
            "#7BDBB2",
            "#A1DB30",
            "#FCBF49"
          ]
        },
        "accent5": {
          "type": "string",
          "description": "Accent 5 color (hex). Mirrors the OOXML accent5 slot.",
          "examples": [
            "#3AC67A",
            "#0682FE",
            "#EAE2B7"
          ]
        },
        "accent6": {
          "type": "string",
          "description": "Accent 6 color (hex). Mirrors the OOXML accent6 slot.",
          "examples": [
            "#24A89E",
            "#FC03BE",
            "#BFBFBF"
          ]
        },
        "dark1": {
          "type": "string",
          "description": "Dark 1 color (hex). Typically the deepest neutral; OOXML dark1.",
          "examples": [
            "#000000"
          ]
        },
        "dark2": {
          "type": "string",
          "description": "Dark 2 color (hex). Secondary dark; OOXML dark2.",
          "examples": [
            "#011842",
            "#2C2C2C"
          ]
        },
        "light1": {
          "type": "string",
          "description": "Light 1 color (hex). Typically the slide canvas; OOXML lt1.",
          "examples": [
            "#FFFFFF"
          ]
        },
        "light2": {
          "type": "string",
          "description": "Light 2 color (hex). Secondary light surface; OOXML lt2.",
          "examples": [
            "#F0F0F0",
            "#F3F7FF"
          ]
        },
        "hyperlink": {
          "type": "string",
          "description": "Hyperlink color (hex). OOXML hlink.",
          "examples": [
            "#0563C1",
            "#0066CC"
          ]
        },
        "followedHyperlink": {
          "type": "string",
          "description": "Followed-hyperlink color (hex). OOXML folHlink.",
          "examples": [
            "#954F72",
            "#551A8B"
          ]
        },
        "primary": {
          "type": "string",
          "description": "Abstract role: primary brand color (hex). The engine maps this onto an OOXML accent slot when serializing.",
          "examples": [
            "#1E40AF",
            "#0F172A"
          ]
        },
        "secondary": {
          "type": "string",
          "description": "Abstract role: secondary brand color (hex).",
          "examples": [
            "#3B82F6",
            "#64748B"
          ]
        },
        "accent": {
          "type": "string",
          "description": "Abstract role: accent color used for highlights and emphasis (hex).",
          "examples": [
            "#F59E0B",
            "#22D3EE"
          ]
        },
        "background": {
          "type": "string",
          "description": "Abstract role: default slide background color (hex). The engine maps this to one of light1 / light2 / dark1 / dark2 when serializing.",
          "examples": [
            "#FFFFFF",
            "#0B1220"
          ]
        },
        "surface": {
          "type": "string",
          "description": "Abstract role: color for elevated surfaces such as cards and panels (hex).",
          "examples": [
            "#F8FAFC",
            "#1E293B"
          ]
        },
        "text": {
          "type": "string",
          "description": "Abstract role: primary body text color (hex).",
          "examples": [
            "#0F172A",
            "#F8FAFC"
          ]
        },
        "textSecondary": {
          "type": "string",
          "description": "Abstract role: secondary or muted text color used for captions and supporting copy (hex).",
          "examples": [
            "#475569",
            "#94A3B8"
          ]
        },
        "custom": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          },
          "description": "Map of custom named colors for advanced or theme-specific use.",
          "examples": [
            {
              "success": "#10B981",
              "warning": "#F59E0B",
              "danger": "#EF4444"
            }
          ]
        }
      }
    },
    "FontScheme": {
      "type": "object",
      "description": "Typography selections used by the design system. The pair fields (major, minor) and refinement fields (type, app, languageFamily) mirror font-scheme.schema.json (https://openpresentation.org/schema/opf-font-scheme/v1) so library records and inline OPF overrides are interchangeable on those fields.\n\nTwo parallel models are supported and may be mixed:\n- OOXML pairs (major, minor) - heading and body family names that round-trip directly to PowerPoint majorFont/minorFont entries.\n- Abstract roles (heading, body, accent, code) - OPF-specific Font objects the engine maps onto the OOXML pair when serializing. Convenient for inline overrides and for adding accent/code roles that don't have a direct OOXML slot; not part of the catalog record schema.\n\nIn design.fontScheme, 'id' resolves a fontSchemes catalog record as the base; pair and role overrides on the same object take precedence over the resolved scheme. The string shorthand on design.fontScheme is equivalent to setting only 'id'.",
      "properties": {
        "id": {
          "type": "string",
          "description": "Font scheme reference. Resolves to the 'id' of a 'fontSchemes' catalog record. Accepts a bare id (lowercase kebab-case, e.g. 'aptos'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Field overrides on the surrounding FontScheme object take precedence over the resolved scheme.\n\nResolution order: inline catalogs.fontSchemes.records[] -> catalogs.fontSchemes.source -> default catalog at https://www.pptx.gallery/font-schemes.",
          "examples": [
            "aptos",
            "tenorite",
            "seaford",
            "noto-sans",
            "modern-sans",
            "classic-serif",
            "https://acme.com/decks/font-schemes/acme.json",
            "pkg:@acme/decks/font-schemes/acme"
          ]
        },
        "major": {
          "type": "string",
          "description": "Heading (major) font family \u2014 mirrors the OOXML majorFont entry. Pairs with 'minor'.",
          "examples": [
            "Aptos Display",
            "Calibri",
            "Microsoft YaHei",
            "Arial Black"
          ]
        },
        "minor": {
          "type": "string",
          "description": "Body (minor) font family \u2014 mirrors the OOXML minorFont entry. Pairs with 'major'.",
          "examples": [
            "Aptos",
            "Calibri",
            "Microsoft YaHei",
            "Arial"
          ]
        },
        "type": {
          "type": "string",
          "enum": [
            "sans-serif",
            "serif",
            "monospace"
          ],
          "description": "High-level typographic class of the scheme."
        },
        "app": {
          "type": "string",
          "enum": [
            "PowerPoint",
            "Google Slides"
          ],
          "description": "Target application this font pairing is intended for."
        },
        "languageFamily": {
          "type": "string",
          "enum": [
            "latin",
            "ea",
            "cs"
          ],
          "description": "OOXML font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' for East Asian scripts, 'cs' for Complex Scripts."
        },
        "heading": {
          "$ref": "#/$defs/Font",
          "description": "Abstract role: font used for slide titles and headings. Maps onto the OOXML major slot when serializing."
        },
        "body": {
          "$ref": "#/$defs/Font",
          "description": "Abstract role: font used for body copy. Maps onto the OOXML minor slot when serializing."
        },
        "accent": {
          "$ref": "#/$defs/Font",
          "description": "Abstract role: font used for accent text such as quotes or callouts. No direct OOXML slot."
        },
        "code": {
          "$ref": "#/$defs/Font",
          "description": "Abstract role: monospaced font used for code blocks. No direct OOXML slot."
        }
      }
    },
    "Font": {
      "type": "object",
      "description": "Specification for a single font role.",
      "required": [
        "family"
      ],
      "properties": {
        "family": {
          "type": "string",
          "description": "Font family name.",
          "examples": [
            "Inter",
            "Roboto",
            "Source Serif Pro",
            "JetBrains Mono"
          ]
        },
        "weight": {
          "type": "number",
          "description": "Numeric font weight (e.g., 400 for regular, 700 for bold)."
        },
        "style": {
          "type": "string",
          "enum": [
            "normal",
            "italic"
          ],
          "description": "Font style."
        },
        "letterSpacing": {
          "type": "number",
          "description": "Letter spacing (tracking) in ems."
        }
      }
    },
    "DimensionPreset": {
      "type": "string",
      "enum": [
        "16:9",
        "4:3",
        "16:10",
        "letter",
        "a4",
        "widescreen",
        "standard"
      ],
      "description": "Named dimension preset; chooses both aspect ratio and physical size. 'widescreen' is an alias for 16:9 in PowerPoint widescreen size; 'standard' is an alias for 4:3 in PowerPoint standard size."
    },
    "Dimensions": {
      "type": "object",
      "description": "Slide dimensions; either pick a preset or specify custom inches.",
      "properties": {
        "preset": {
          "$ref": "#/$defs/DimensionPreset"
        },
        "widthInches": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Custom slide width in inches; overrides the preset width when provided."
        },
        "heightInches": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Custom slide height in inches; overrides the preset height when provided."
        }
      }
    },
    "ThemeBackgroundSlot": {
      "type": "string",
      "description": "PowerPoint theme-controlled slide background slot from the active color scheme. These are slots, not assumptions about actual colors: light1 is usually white and dark1 is usually black by convention, but the color scheme controls the real values.",
      "enum": [
        "light1",
        "light2",
        "dark1",
        "dark2"
      ]
    },
    "HexColor": {
      "type": "string",
      "pattern": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
      "description": "Hex color shorthand accepted by selected string fields.",
      "examples": [
        "#fff",
        "#ffff00",
        "#0F172AFF"
      ]
    },
    "BackgroundShortcut": {
      "oneOf": [
        {
          "$ref": "#/$defs/ThemeBackgroundSlot"
        },
        {
          "$ref": "#/$defs/HexColor"
        }
      ],
      "description": "String shorthand for a background. Theme slots ('light1', 'light2', 'dark1', 'dark2') are equivalent to { type: 'theme', slot: value }; hex colors are equivalent to { type: 'solid', color: value }.",
      "examples": [
        "dark1",
        "light2",
        "#ffff00"
      ]
    },
    "Background": {
      "description": "Background fill applied to slides. Theme backgrounds preserve PowerPoint's color-scheme background choice; other variants represent fixed background fills.",
      "oneOf": [
        {
          "$ref": "#/$defs/ThemeBackground"
        },
        {
          "$ref": "#/$defs/SolidBackground"
        },
        {
          "$ref": "#/$defs/GradientBackground"
        },
        {
          "$ref": "#/$defs/ImageBackground"
        },
        {
          "$ref": "#/$defs/PatternBackground"
        }
      ]
    },
    "ThemeBackground": {
      "type": "object",
      "description": "Theme-controlled PowerPoint slide background. The slot is resolved through the active color scheme and remains theme-aware.",
      "required": [
        "type",
        "slot"
      ],
      "properties": {
        "type": {
          "type": "string",
          "const": "theme",
          "description": "Theme-controlled background fill."
        },
        "slot": {
          "$ref": "#/$defs/ThemeBackgroundSlot"
        }
      }
    },
    "SolidBackground": {
      "type": "object",
      "description": "Fixed solid slide background fill.",
      "required": [
        "type",
        "color"
      ],
      "properties": {
        "type": {
          "type": "string",
          "const": "solid",
          "description": "Fixed solid background fill."
        },
        "color": {
          "type": "string",
          "description": "Fixed solid fill color, usually a hex string. Use { type: 'theme', slot: ... } for PowerPoint's four theme-controlled background choices.",
          "examples": [
            "#FFFFFF",
            "#0F172A",
            "#F8FAFC"
          ]
        },
        "opacity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Background opacity from 0 (fully transparent) to 1 (fully opaque)."
        }
      }
    },
    "GradientBackground": {
      "type": "object",
      "description": "Fixed gradient slide background fill.",
      "required": [
        "type",
        "gradient"
      ],
      "properties": {
        "type": {
          "type": "string",
          "const": "gradient",
          "description": "Fixed gradient background fill."
        },
        "gradient": {
          "type": "object",
          "description": "Gradient fill definition.",
          "properties": {
            "angle": {
              "type": "number",
              "description": "Gradient angle in degrees (0 = left-to-right, 90 = top-to-bottom)."
            },
            "stops": {
              "type": "array",
              "description": "Ordered list of color stops along the gradient.",
              "items": {
                "type": "object",
                "description": "Color stop along the gradient.",
                "required": [
                  "color",
                  "position"
                ],
                "properties": {
                  "color": {
                    "type": "string",
                    "description": "Stop color as a hex string.",
                    "examples": [
                      "#1E40AF",
                      "#22D3EE"
                    ]
                  },
                  "position": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Stop position along the gradient, from 0 (start) to 1 (end)."
                  }
                }
              }
            }
          }
        },
        "opacity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Background opacity from 0 (fully transparent) to 1 (fully opaque)."
        }
      }
    },
    "ImageBackground": {
      "type": "object",
      "description": "Fixed image slide background fill.",
      "required": [
        "type",
        "image"
      ],
      "properties": {
        "type": {
          "type": "string",
          "const": "image",
          "description": "Fixed image background fill."
        },
        "image": {
          "type": "object",
          "description": "Image fill definition.",
          "required": [
            "src"
          ],
          "properties": {
            "src": {
              "type": "string",
              "description": "Source for the background image.",
              "examples": [
                "https://cdn.acme.com/backgrounds/cover.jpg",
                "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA...",
                "./backgrounds/cover.jpg",
                "asset:bg-cover"
              ]
            },
            "fit": {
              "type": "string",
              "enum": [
                "cover",
                "contain",
                "tile"
              ],
              "description": "How the image fills the slide background."
            }
          }
        },
        "opacity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Background opacity from 0 (fully transparent) to 1 (fully opaque)."
        }
      }
    },
    "PatternBackground": {
      "type": "object",
      "description": "Fixed pattern slide background fill.",
      "required": [
        "type",
        "pattern"
      ],
      "properties": {
        "type": {
          "type": "string",
          "const": "pattern",
          "description": "Fixed pattern background fill."
        },
        "pattern": {
          "type": "object",
          "description": "Pattern fill definition.",
          "required": [
            "preset"
          ],
          "properties": {
            "preset": {
              "type": "string",
              "description": "Pattern preset or engine-defined pattern id.",
              "examples": [
                "pct5",
                "ltHorz",
                "diagStripe"
              ]
            },
            "foregroundColor": {
              "type": "string",
              "description": "Foreground color for the pattern, usually a hex string.",
              "examples": [
                "#0F172A"
              ]
            },
            "backgroundColor": {
              "type": "string",
              "description": "Background color behind the pattern, usually a hex string.",
              "examples": [
                "#FFFFFF"
              ]
            }
          }
        },
        "opacity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Background opacity from 0 (fully transparent) to 1 (fully opaque)."
        }
      }
    },
    "LogoSet": {
      "type": "object",
      "description": "Deck logo variants surfaced by layouts, covers, section dividers, headers, and footers. Organization identity lives in organization; this object only controls visual rendering assets. Renderer convention: on dark backgrounds prefer the 'light' variant, on light backgrounds prefer the 'dark' variant, and in square/vertical slots prefer the stacked family when present.",
      "additionalProperties": false,
      "properties": {
        "default": {
          "$ref": "#/$defs/Asset",
          "description": "Default full-lockup logo. Used as fallback when no more specific variant is set."
        },
        "light": {
          "$ref": "#/$defs/Asset",
          "description": "Light-colored full-lockup logo intended for rendering on dark backgrounds."
        },
        "dark": {
          "$ref": "#/$defs/Asset",
          "description": "Dark-colored full-lockup logo intended for rendering on light backgrounds."
        },
        "stacked": {
          "$ref": "#/$defs/Asset",
          "description": "Stacked vertical logo lockup, suited to portrait or square brand-mark slots."
        },
        "stackedLight": {
          "$ref": "#/$defs/Asset",
          "description": "Light-colored stacked logo variant intended for rendering on dark backgrounds."
        },
        "stackedDark": {
          "$ref": "#/$defs/Asset",
          "description": "Dark-colored stacked logo variant intended for rendering on light backgrounds."
        },
        "icon": {
          "$ref": "#/$defs/Asset",
          "description": "Default icon, mark, or symbol without wordmark. Useful for tight spaces such as footers, badges, and slide-corner marks."
        },
        "iconLight": {
          "$ref": "#/$defs/Asset",
          "description": "Light-colored icon variant intended for rendering on dark backgrounds."
        },
        "iconDark": {
          "$ref": "#/$defs/Asset",
          "description": "Dark-colored icon variant intended for rendering on light backgrounds."
        },
        "wordmark": {
          "$ref": "#/$defs/Asset",
          "description": "Default wordmark: the organization name set in branded typography, without icon."
        },
        "wordmarkLight": {
          "$ref": "#/$defs/Asset",
          "description": "Light-colored wordmark variant intended for rendering on dark backgrounds."
        },
        "wordmarkDark": {
          "$ref": "#/$defs/Asset",
          "description": "Dark-colored wordmark variant intended for rendering on light backgrounds."
        }
      }
    },
    "Watermark": {
      "type": "object",
      "description": "Decorative watermark image and rendering options. Use design.watermark = false to disable an inherited watermark.",
      "additionalProperties": false,
      "required": [
        "opacity"
      ],
      "properties": {
        "src": {
          "type": "string",
          "description": "Source for the watermark image."
        },
        "opacity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Watermark opacity from 0 (fully transparent) to 1 (fully opaque)."
        }
      }
    },
    "HeaderFooter": {
      "type": "object",
      "description": "Repeated header or footer content split into left, center, and right zones. Header/footer content is slide furniture, separate from the main slide content payloads.",
      "properties": {
        "left": {
          "$ref": "#/$defs/HeaderFooterItem",
          "description": "Left-aligned header/footer content."
        },
        "center": {
          "$ref": "#/$defs/HeaderFooterItem",
          "description": "Centered header/footer content."
        },
        "right": {
          "$ref": "#/$defs/HeaderFooterItem",
          "description": "Right-aligned header/footer content."
        }
      }
    },
    "HeaderFooterItem": {
      "type": "object",
      "description": "One header/footer zone. Fields may be combined when the renderer supports it; otherwise renderers should prefer image, then text-like generated content.",
      "properties": {
        "text": {
          "type": "string",
          "description": "Literal text rendered in this zone.",
          "examples": [
            "Confidential",
            "Q4 Business Review"
          ]
        },
        "image": {
          "$ref": "#/$defs/Asset",
          "description": "Generic image rendered in this zone, such as a logo, partner mark, certification badge, or icon.",
          "examples": [
            "asset:acme-logo",
            "./assets/footer-badge.svg"
          ]
        },
        "slideNumber": {
          "type": "boolean",
          "description": "Whether to render the current slide number in this zone."
        },
        "date": {
          "oneOf": [
            {
              "type": "boolean"
            },
            {
              "type": "string"
            }
          ],
          "description": "Whether to render the presentation date, or a literal date string to render."
        },
        "organization": {
          "type": "boolean",
          "description": "Whether to render the primary organization name from organization."
        },
        "section": {
          "type": "boolean",
          "description": "Whether to render the current slide section label."
        }
      }
    },
    "Slide": {
      "type": "object",
      "description": "A single slide. Content can be authored as a full-slide root payload, or inside promoted named region keys such as 'left', 'center+right', and 'top:left'.",
      "additionalProperties": false,
      "properties": {
        "id": {
          "type": "string",
          "description": "Optional stable identifier for the slide within the document. Use when another system needs to reference a slide across edits, comments, generation state, exports, or narrative tooling. Slide order is defined by the slides array, so simple decks may omit this.",
          "examples": [
            "s1",
            "cover",
            "problem-1",
            "ask"
          ]
        },
        "type": {
          "type": "string",
          "enum": [
            "text",
            "list",
            "image",
            "chart",
            "table",
            "video",
            "code",
            "metric",
            "quote",
            "timeline"
          ],
          "description": "Optional full-slide content kind. When omitted, engines infer the kind from root payload fields."
        },
        "beat": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ],
          "description": "Optional reference to one or more narrative beats (each value matches an id from narrative.beats or the resolved template). A single string declares the slide's primary beat; an array declares that one slide covers multiple beats. Declares the slide's role in the story arc; does not constrain ordering or structure. Slides without a beat are valid; multiple slides may share a beat."
        },
        "layout": {
          "type": "string",
          "description": "Optional slide layout reference. Resolves to the 'id' of a 'layouts' catalog record. When omitted, engines infer a layout from the slide's root payload or promoted region keys. Accepts a bare id (lowercase kebab-case, e.g. 'title-subtitle'), an HTTPS URL pointing at a record file, or a 'pkg:' reference. Free-form custom layout names that don't resolve through any catalog fall through to engine-defined layouts.\n\nResolution order: inline catalogs.layouts.records[] \u2192 catalogs.layouts.source \u2192 default catalog at https://www.pptx.gallery/layouts.",
          "examples": [
            "title",
            "title-subtitle",
            "text-2x",
            "chart-3x",
            "image-bleed",
            "blank",
            "https://acme.com/decks/layouts/cover.json",
            "pkg:@acme/decks/layouts/cover"
          ]
        },
        "title": {
          "type": "string",
          "description": "Slide-level title content. When the resolved layout exposes a 'title' placeholder, the engine renders this value there.",
          "examples": [
            "Quarterly Review",
            "Why Now",
            "Next Steps"
          ]
        },
        "subtitle": {
          "type": "string",
          "description": "Slide-level subtitle or supporting line. When the resolved layout exposes a 'subtitle' placeholder, the engine renders this value there.",
          "examples": [
            "Prepared for the board",
            "Three signals changed this quarter"
          ]
        },
        "tag": {
          "type": "string",
          "description": "Small slide-level label or badge. When the resolved layout exposes a 'tag' placeholder, the engine renders this value there.",
          "examples": [
            "Intro",
            "Confidential",
            "Appendix"
          ]
        },
        "text": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/$defs/TextRun"
              }
            }
          ],
          "description": "Full-slide text payload. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects."
        },
        "items": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ListItem"
          },
          "description": "Full-slide generic list payload. Presence of this field infers type 'list'. At slide root, multiple content payload kinds with no explicit type, blocks, or regions are accepted as shorthand for layout-agnostic blocks."
        },
        "bullets": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/BulletItem"
          },
          "description": "Full-slide text-style bullet payload. Presence of this field infers type 'text'."
        },
        "image": {
          "$ref": "#/$defs/Asset",
          "description": "Full-slide image source. Presence of this field infers type 'image'."
        },
        "video": {
          "$ref": "#/$defs/Asset",
          "description": "Full-slide video source. Presence of this field infers type 'video'."
        },
        "chart": {
          "$ref": "#/$defs/Chart",
          "description": "Full-slide chart payload. Presence of this field infers type 'chart'."
        },
        "table": {
          "$ref": "#/$defs/Table",
          "description": "Full-slide table payload. Presence of this field infers type 'table'."
        },
        "code": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/Code"
            }
          ],
          "description": 'Full-slide code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata.'
        },
        "metric": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            },
            {
              "$ref": "#/$defs/Metric"
            }
          ],
          "description": `Full-slide metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, and trend metadata. Numeric values remain numbers; renderers format them for display. Presence of this field infers type 'metric'.`
        },
        "quote": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/Quote"
            }
          ],
          "description": `Full-slide quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata. Presence of this field infers type 'quote'.`
        },
        "timeline": {
          "$ref": "#/$defs/Timeline",
          "description": `Full-slide timeline payload. An array is shorthand for { "events": value }; object form carries optional name and description metadata. Presence of this field infers type 'timeline'.`
        },
        "blocks": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ContentPayload"
          },
          "description": "Layout-agnostic content blocks rendered together as a composed payload when exact placement is unspecified. At slide root, multiple content payload kinds with no explicit type, blocks, or regions are accepted as shorthand for equivalent blocks."
        },
        "design": {
          "$ref": "#/$defs/Design",
          "description": "Slide-level design applied on top of the deck-wide design."
        },
        "left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top:left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top:center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top:right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top:left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top:center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top:left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle:left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle:center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle:right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle:left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle:center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle:left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom:left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom:center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom:right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom:left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom:center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "bottom:left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle:left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle:center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle:right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle:left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle:center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle:left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom:left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom:center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom:right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom:left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom:center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "middle+bottom:left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom:left": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom:center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom:right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom:left+center": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom:center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "top+middle+bottom:left+center+right": {
          "$ref": "#/$defs/ContentPayload"
        },
        "notes": {
          "type": "string",
          "description": "Speaker notes shown in presenter view.",
          "examples": [
            "Open with the customer story; pause for questions before moving to the architecture slide."
          ]
        },
        "section": {
          "type": "string",
          "description": "PowerPoint-style slide section label. Consecutive slides with the same value belong to the same section in presenter view, outlines, and PowerPoint section-aware exports.",
          "examples": [
            "Intro",
            "Problem",
            "Solution",
            "Ask",
            "Appendix"
          ]
        },
        "hidden": {
          "type": "boolean",
          "description": "Whether the slide is hidden from the presented sequence."
        },
        "composition": {
          "$ref": "#/$defs/Composition"
        }
      }
    },
    "ContentPayload": {
      "type": "object",
      "description": "A content leaf or recursively composed group. A group contains blocks and optional composition; it cannot mix blocks with leaf payload fields. Groups may nest up to 32 levels.",
      "additionalProperties": false,
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "text",
            "list",
            "image",
            "chart",
            "table",
            "video",
            "code",
            "metric",
            "quote",
            "timeline",
            "group"
          ],
          "description": "Optional content kind. When omitted, engines infer the kind from the fields present."
        },
        "text": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/$defs/TextRun"
              }
            }
          ],
          "description": "Text payload. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects.",
          "examples": [
            "Hello, world",
            [
              "Revenue grew ",
              {
                "text": "42%",
                "bold": true,
                "color": "#16A34A"
              },
              " year over year."
            ]
          ]
        },
        "items": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/ListItem"
          },
          "description": "Generic list payload. Each item is either a plain string, a TextRun[] rich text sequence, or a ListItem object. List nesting uses item.level rather than nested content payloads.",
          "examples": [
            [
              "Sub-second agent latency",
              [
                "Drop-in compatible with ",
                {
                  "text": "OpenAI tool-calling",
                  "bold": true
                }
              ],
              {
                "text": "SOC 2 Type II",
                "description": "Security review ready for enterprise procurement."
              }
            ]
          ]
        },
        "bullets": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/BulletItem"
          },
          "description": "Text-style bullet payload. Presence of this field infers type 'text'.",
          "examples": [
            [
              "Sub-second agent latency",
              "Drop-in compatible with OpenAI tool-calling",
              "SOC 2 Type II"
            ]
          ]
        },
        "image": {
          "$ref": "#/$defs/Asset",
          "description": "Source for an image item.",
          "examples": [
            "https://cdn.acme.com/images/diagram.png",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9V3iWggAAAAASUVORK5CYII=",
            "./images/diagram.png",
            "asset:img-diagram"
          ]
        },
        "video": {
          "$ref": "#/$defs/Asset",
          "description": "Source for a video item.",
          "examples": [
            "asset:demo-video",
            "./media/demo.mp4"
          ]
        },
        "chart": {
          "$ref": "#/$defs/Chart",
          "description": "Chart payload. Presence of this field infers type 'chart'."
        },
        "table": {
          "$ref": "#/$defs/Table",
          "description": "Table payload. Presence of this field infers type 'table'."
        },
        "code": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/Code"
            }
          ],
          "description": 'Code payload. A string is shorthand for { "source": value }; object form carries optional syntax language and filename metadata.',
          "examples": [
            'def greet(name: str) -> str:\n    return f"Hello, {name}!"',
            {
              "source": "export function greet(name: string) {\n  return `Hello, ${name}`;\n}",
              "language": "ts",
              "filename": "greet.ts"
            }
          ]
        },
        "metric": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            },
            {
              "$ref": "#/$defs/Metric"
            }
          ],
          "description": 'Metric payload. A string or number is shorthand for { "value": value }; object form carries optional label, description, unit, delta, and trend metadata. Numeric values remain numbers; renderers format them for display.',
          "examples": [
            "98%",
            42,
            {
              "value": "$12.4M",
              "label": "Revenue",
              "description": "Recognized revenue for the quarter.",
              "delta": "+12%",
              "trend": "up"
            }
          ]
        },
        "quote": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "$ref": "#/$defs/Quote"
            }
          ],
          "description": 'Quote payload. A string is shorthand for { "text": value }; object form carries optional attribution and source metadata.',
          "examples": [
            "This changed how our team handles reviews.",
            {
              "text": "This changed how our team handles reviews.",
              "attribution": "VP Operations, Acme Corp",
              "source": "Customer interview, March 2026"
            }
          ]
        },
        "timeline": {
          "$ref": "#/$defs/Timeline",
          "description": "Timeline payload ordered by narrative or chronology.",
          "examples": [
            [
              {
                "when": "2026-01",
                "what": "Pilot",
                "description": "Launch with the first operations team."
              },
              {
                "when": "2026-04",
                "what": "Rollout",
                "description": "Expand to all regions."
              }
            ],
            {
              "name": "Rollout Plan",
              "description": "Major milestones for the regional rollout.",
              "events": [
                {
                  "when": "Q1",
                  "what": "Pilot"
                },
                {
                  "when": "Q2",
                  "what": "Rollout"
                }
              ]
            }
          ]
        },
        "blocks": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/ContentPayload"
          },
          "description": "Ordered children of a group. Each child is a leaf or another group."
        },
        "composition": {
          "$ref": "#/$defs/Composition",
          "description": "Arrangement within this group. Only minFontSize and overflow inherit from the parent; strict overflow cannot be weakened."
        }
      },
      "allOf": [
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "list"
              }
            }
          },
          "then": {
            "required": [
              "items"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "image"
              }
            }
          },
          "then": {
            "required": [
              "image"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "chart"
              }
            }
          },
          "then": {
            "required": [
              "chart"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "table"
              }
            }
          },
          "then": {
            "required": [
              "table"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "video"
              }
            }
          },
          "then": {
            "required": [
              "video"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "code"
              }
            }
          },
          "then": {
            "required": [
              "code"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "metric"
              }
            }
          },
          "then": {
            "required": [
              "metric"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "quote"
              }
            }
          },
          "then": {
            "required": [
              "quote"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "timeline"
              }
            }
          },
          "then": {
            "required": [
              "timeline"
            ]
          }
        },
        {
          "if": {
            "required": [
              "type"
            ],
            "properties": {
              "type": {
                "const": "group"
              }
            }
          },
          "then": {
            "required": [
              "blocks"
            ]
          }
        },
        {
          "if": {
            "required": [
              "composition"
            ]
          },
          "then": {
            "required": [
              "blocks"
            ]
          }
        },
        {
          "if": {
            "required": [
              "blocks"
            ]
          },
          "then": {
            "properties": {
              "type": {
                "const": "group"
              }
            },
            "not": {
              "anyOf": [
                {
                  "required": [
                    "text"
                  ]
                },
                {
                  "required": [
                    "items"
                  ]
                },
                {
                  "required": [
                    "bullets"
                  ]
                },
                {
                  "required": [
                    "image"
                  ]
                },
                {
                  "required": [
                    "video"
                  ]
                },
                {
                  "required": [
                    "chart"
                  ]
                },
                {
                  "required": [
                    "table"
                  ]
                },
                {
                  "required": [
                    "code"
                  ]
                },
                {
                  "required": [
                    "metric"
                  ]
                },
                {
                  "required": [
                    "quote"
                  ]
                },
                {
                  "required": [
                    "timeline"
                  ]
                }
              ]
            }
          }
        }
      ]
    },
    "Quote": {
      "type": "object",
      "description": `Quote content with optional attribution metadata. Use 'text' for the quoted text, 'attribution' for the credited person or organization, and 'source' for a citation or URL. A string value in a quote field is shorthand for { "text": value }.`,
      "additionalProperties": false,
      "required": [
        "text"
      ],
      "properties": {
        "text": {
          "type": "string",
          "description": "Quoted text.",
          "examples": [
            "This changed how our team handles reviews."
          ]
        },
        "attribution": {
          "type": "string",
          "description": "Person or organization credited for the quote.",
          "examples": [
            "VP Operations, Acme Corp"
          ]
        },
        "source": {
          "type": "string",
          "description": "Optional quote source, citation, or URL.",
          "examples": [
            "Customer interview, March 2026",
            "https://acme.com/case-study"
          ]
        }
      }
    },
    "Code": {
      "type": "object",
      "description": `Code content with optional rendering metadata. Use 'source' for the code text, 'language' for syntax highlighting, and 'filename' when the rendered block should show a file label. A string value in a code field is shorthand for { "source": value }.`,
      "additionalProperties": false,
      "required": [
        "source"
      ],
      "properties": {
        "source": {
          "type": "string",
          "description": "Source code text to display.",
          "examples": [
            'def greet(name: str) -> str:\n    return f"Hello, {name}!"'
          ]
        },
        "language": {
          "type": "string",
          "description": "Language identifier used for syntax highlighting.",
          "examples": [
            "python",
            "ts",
            "tsx",
            "rust",
            "go",
            "bash",
            "json",
            "yaml"
          ]
        },
        "filename": {
          "type": "string",
          "description": "Optional file label shown with the code block.",
          "examples": [
            "app.py",
            "components/Button.tsx",
            "terraform/main.tf"
          ]
        }
      }
    },
    "Metric": {
      "type": "object",
      "description": `Metric content with optional display metadata. Use 'value' for the primary value, 'label' for the metric name, 'description' for supporting context, 'unit' for a suffix/currency marker, 'delta' for change, and 'trend' for direction. A string or number value in a metric field is shorthand for { "value": value }; numeric values remain numbers and are formatted by renderers.`,
      "additionalProperties": false,
      "required": [
        "value"
      ],
      "properties": {
        "value": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ],
          "description": "Primary metric value.",
          "examples": [
            42,
            "$12.4M",
            "98%"
          ]
        },
        "label": {
          "type": "string",
          "description": "Metric label.",
          "examples": [
            "Revenue",
            "Retention",
            "Latency"
          ]
        },
        "description": {
          "type": "string",
          "description": "Optional supporting context for the metric.",
          "examples": [
            "Recognized revenue for the quarter.",
            "Median API latency across production traffic."
          ]
        },
        "unit": {
          "type": "string",
          "description": "Metric unit, suffix, or currency marker.",
          "examples": [
            "%",
            "ms",
            "$M"
          ]
        },
        "delta": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "number"
            }
          ],
          "description": "Metric change value.",
          "examples": [
            "+12%",
            -4.2
          ]
        },
        "trend": {
          "type": "string",
          "enum": [
            "up",
            "down",
            "flat"
          ],
          "description": "Metric trend direction."
        }
      }
    },
    "Timeline": {
      "description": 'Timeline content. An array is shorthand for { "events": value }; object form carries optional name and description metadata.',
      "oneOf": [
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TimelineEvent"
          },
          "minItems": 1
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "events"
          ],
          "properties": {
            "name": {
              "type": "string",
              "description": "Short timeline label.",
              "examples": [
                "Rollout Plan",
                "Migration Path"
              ]
            },
            "description": {
              "type": "string",
              "description": "Optional timeline-level context.",
              "examples": [
                "Major milestones for the regional rollout."
              ]
            },
            "events": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/TimelineEvent"
              },
              "minItems": 1,
              "description": "Timeline events ordered by narrative, sequence, or chronology."
            }
          }
        }
      ]
    },
    "TimelineEvent": {
      "type": "object",
      "description": "A single event inside a timeline content payload.",
      "required": [
        "what"
      ],
      "additionalProperties": false,
      "properties": {
        "when": {
          "type": "string",
          "description": "Event time, date, or sequence label. Use ISO-like values when possible, but human labels are allowed for quarters, eras, and relative milestones.",
          "examples": [
            "2026-01",
            "Q2 2026",
            "Launch week"
          ]
        },
        "what": {
          "type": "string",
          "description": "Short event label.",
          "examples": [
            "Pilot",
            "Rollout",
            "Scale"
          ]
        },
        "description": {
          "type": "string",
          "description": "Optional event detail.",
          "examples": [
            "Launch with the first operations team."
          ]
        }
      }
    },
    "ListItem": {
      "description": "A flat item inside a list. Strings cover the common case, TextRun[] supports inline rich text without an object wrapper, and object form adds description and nesting depth without creating nested slide content payloads.",
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TextRun"
          }
        },
        {
          "type": "object",
          "required": [
            "text"
          ],
          "additionalProperties": false,
          "properties": {
            "text": {
              "oneOf": [
                {
                  "type": "string"
                },
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/TextRun"
                  }
                }
              ],
              "description": "Text for the list item. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects.",
              "examples": [
                "Improve retention by 12 points",
                [
                  "Improve retention by ",
                  {
                    "text": "12 points",
                    "bold": true
                  }
                ]
              ]
            },
            "description": {
              "oneOf": [
                {
                  "type": "string"
                },
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/TextRun"
                  }
                }
              ],
              "description": "Optional supporting detail for the list item. Use a string for plain text or TextRun[] for inline rich text.",
              "examples": [
                "Focused on activation and first-value time.",
                [
                  "Focused on ",
                  {
                    "text": "activation",
                    "bold": true
                  },
                  " and first-value time."
                ]
              ]
            },
            "level": {
              "type": "integer",
              "minimum": 0,
              "description": "Zero-based nesting level for the list item."
            }
          }
        }
      ]
    },
    "BulletItem": {
      "description": "A flat bullet item. Strings cover the common case, TextRun[] supports inline rich text without an object wrapper, and object form adds nesting depth without list-item descriptions.",
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TextRun"
          }
        },
        {
          "type": "object",
          "required": [
            "text"
          ],
          "additionalProperties": false,
          "properties": {
            "text": {
              "oneOf": [
                {
                  "type": "string"
                },
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/TextRun"
                  }
                }
              ],
              "description": "Text for the bullet. Use a string for plain text or TextRun[] for inline rich text. TextRun items may be plain strings or formatted run objects.",
              "examples": [
                "Improve retention by 12 points",
                [
                  "Improve retention by ",
                  {
                    "text": "12 points",
                    "bold": true
                  }
                ]
              ]
            },
            "level": {
              "type": "integer",
              "minimum": 0,
              "description": "Zero-based nesting level for the bullet."
            }
          }
        }
      ]
    },
    "TextRun": {
      "description": "A contiguous run of text. Strings cover unformatted spans; object form adds character formatting.",
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "object",
          "required": [
            "text"
          ],
          "properties": {
            "text": {
              "type": "string",
              "description": "Text for this run.",
              "examples": [
                "Hello, ",
                "world"
              ]
            },
            "bold": {
              "type": "boolean",
              "description": "Whether the run is rendered in bold."
            },
            "italic": {
              "type": "boolean",
              "description": "Whether the run is rendered in italic."
            },
            "underline": {
              "type": "boolean",
              "description": "Whether the run is underlined."
            },
            "strikethrough": {
              "type": "boolean",
              "description": "Whether the run is rendered with a strikethrough line."
            },
            "color": {
              "type": "string",
              "description": "Run text color as a hex string.",
              "examples": [
                "#0F172A",
                "#1E40AF"
              ]
            },
            "fontSize": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Requested run font size in points."
            },
            "fontFamily": {
              "type": "string",
              "description": "Run font family override.",
              "examples": [
                "Inter",
                "Source Serif Pro",
                "JetBrains Mono"
              ]
            },
            "link": {
              "type": "string",
              "description": "URL to link the run text to.",
              "examples": [
                "https://acme.com",
                "https://acme.com/case-studies/beta"
              ]
            },
            "superscript": {
              "type": "boolean",
              "description": "Whether the run is rendered as superscript."
            },
            "subscript": {
              "type": "boolean",
              "description": "Whether the run is rendered as subscript."
            }
          }
        }
      ]
    },
    "Chart": {
      "type": "object",
      "description": "Chart content. The chart object keeps chart-specific fields together so slides and regions do not expose loose chart fields.",
      "additionalProperties": false,
      "required": [
        "type",
        "data"
      ],
      "properties": {
        "type": {
          "type": "string",
          "description": "Chart type id. Resolves to the id of a chartTypes catalog record; renderers map that record through mappings.openxml and any renderer-specific mapping they understand.",
          "examples": [
            "bar",
            "column",
            "line",
            "pie",
            "donut",
            "doughnut",
            "area",
            "scatter",
            "radar",
            "waterfall",
            "funnel",
            "treemap",
            "combo"
          ]
        },
        "data": {
          "oneOf": [
            {
              "$ref": "#/$defs/ChartData"
            },
            {
              "$ref": "#/$defs/ChartDataSource"
            }
          ],
          "description": "Chart data. Inline data uses a tabular columns/rows shape; renderers convert rows to chart series internally."
        }
      }
    },
    "Table": {
      "type": "object",
      "description": "Table content. Columns are optional; rows are the only required field.",
      "additionalProperties": false,
      "required": [
        "rows"
      ],
      "properties": {
        "columns": {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "array",
                "items": {
                  "$ref": "#/$defs/TextRun"
                }
              },
              {
                "$ref": "#/$defs/StyledTableCell"
              },
              {
                "type": "null"
              }
            ]
          },
          "description": "Optional column labels. Labels may be strings, rich runs or styled cell objects. Null is an empty label or a placeholder covered by a preceding column span.",
          "examples": [
            [
              "Region",
              "Q3 Revenue",
              "Q4 Revenue",
              "YoY %"
            ]
          ]
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/$defs/TableCell"
            }
          },
          "description": "Two-dimensional table row data; each row aligns by index with columns when columns are supplied.",
          "examples": [
            [
              [
                "North America",
                12.4,
                18.1,
                "46%"
              ],
              [
                "EMEA",
                8.2,
                11.5,
                "40%"
              ]
            ]
          ]
        }
      }
    },
    "ChartData": {
      "type": "object",
      "description": "Inline tabular data driving a chart. The first column usually supplies category/x-axis labels; subsequent columns are plotted measures unless a chart type or renderer maps them differently.",
      "additionalProperties": false,
      "required": [
        "columns",
        "rows"
      ],
      "properties": {
        "columns": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "minItems": 1,
          "description": "Ordered column labels for the chart data table.",
          "examples": [
            [
              "Quarter",
              "Revenue"
            ],
            [
              "Quarter",
              "Revenue",
              "Costs"
            ]
          ]
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/$defs/ChartDataCell"
            }
          },
          "minItems": 1,
          "description": "Tabular chart rows. Each row aligns by index with columns.",
          "examples": [
            [
              [
                "Q1",
                12
              ],
              [
                "Q2",
                18
              ],
              [
                "Q3",
                24
              ],
              [
                "Q4",
                31
              ]
            ]
          ]
        }
      }
    },
    "ChartDataSource": {
      "type": "object",
      "description": "Chart data sourced from an asset reference, URL, data URI, relative path, or local path such as CSV, TSV, JSON, or XLSX. The source is interpreted as a table; optional columns select or order fields from that table.",
      "additionalProperties": false,
      "required": [
        "src"
      ],
      "properties": {
        "src": {
          "type": "string",
          "description": "Data source. Use 'asset:<id>' to reference the top-level assets registry, or provide an HTTPS URL, data URI, relative path, or local filesystem path.",
          "examples": [
            "asset:revenue",
            "asset:pipeline-csv",
            "./data/revenue.csv",
            "https://cdn.acme.com/data/revenue.csv"
          ]
        },
        "sheet": {
          "type": "string",
          "description": "Optional sheet name or table name for spreadsheet-like assets.",
          "examples": [
            "Sheet1",
            "Revenue"
          ]
        },
        "range": {
          "type": "string",
          "description": "Optional A1-style range or engine-defined range selector for spreadsheet-like assets.",
          "examples": [
            "A1:D8",
            "Revenue!A1:D8"
          ]
        },
        "columns": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Optional ordered columns or fields to read from the source. When omitted, renderers may use the source's own header row or schema.",
          "examples": [
            [
              "Quarter",
              "Revenue"
            ],
            [
              "Month",
              "Revenue",
              "Costs"
            ]
          ]
        }
      }
    },
    "ChartDataCell": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        }
      ],
      "description": "A cell in inline chart data."
    },
    "TableCell": {
      "oneOf": [
        {
          "$ref": "#/$defs/TableCellValue"
        },
        {
          "$ref": "#/$defs/StyledTableCell"
        }
      ],
      "description": "A scalar, rich-run array, or styled/spanning cell object. Existing scalar and rich forms remain valid."
    },
    "TableCellValue": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/TextRun"
          }
        }
      ],
      "description": "A scalar table value or canonical rich text runs, without cell decoration or geometry."
    },
    "StyledTableCell": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "value"
      ],
      "properties": {
        "value": {
          "$ref": "#/$defs/TableCellValue",
          "description": "Editable cell content; styling and spans do not change its scalar type or rich runs."
        },
        "style": {
          "$ref": "#/$defs/TableCellStyle"
        },
        "colSpan": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of grid columns covered, starting at this cell. Covered positions must contain null. Default 1."
        },
        "rowSpan": {
          "type": "integer",
          "minimum": 1,
          "description": "Number of grid rows covered, starting at this cell. Covered positions must contain null. Header cells cannot span into body rows. Default 1."
        }
      },
      "description": "A cell with explicit visual style or merged geometry. Its position remains its array column index; use null placeholders for every covered grid position."
    },
    "TableCellStyle": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "fill": {
          "type": "string",
          "pattern": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
          "description": "Explicit RGB or RGBA color. Eight-digit colors include alpha; #00000000 is transparent."
        },
        "color": {
          "type": "string",
          "pattern": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
          "description": "Default text color, overridden by individual rich run colors."
        },
        "align": {
          "type": "string",
          "enum": [
            "left",
            "center",
            "right"
          ],
          "description": "Horizontal text alignment inside the cell."
        },
        "verticalAlign": {
          "type": "string",
          "enum": [
            "top",
            "middle",
            "bottom"
          ],
          "description": "Vertical alignment inside the padded cell box."
        },
        "padding": {
          "$ref": "#/$defs/TableCellPadding"
        },
        "borders": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "top": {
              "$ref": "#/$defs/TableCellBorder"
            },
            "right": {
              "$ref": "#/$defs/TableCellBorder"
            },
            "bottom": {
              "$ref": "#/$defs/TableCellBorder"
            },
            "left": {
              "$ref": "#/$defs/TableCellBorder"
            }
          },
          "description": "Independent cell edges. Omitted edges retain the table theme border; width 0 removes an edge."
        }
      },
      "description": "Cell appearance. Sizes use reference pixels at a 720-pixel canvas short edge and scale with the slide."
    },
    "TableCellPadding": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "top": {
          "type": "number",
          "minimum": 0,
          "maximum": 200
        },
        "right": {
          "type": "number",
          "minimum": 0,
          "maximum": 200
        },
        "bottom": {
          "type": "number",
          "minimum": 0,
          "maximum": 200
        },
        "left": {
          "type": "number",
          "minimum": 0,
          "maximum": 200
        }
      },
      "description": "Text insets in reference pixels. Defaults: top 8, right 10, bottom 4, left 10."
    },
    "TableCellBorder": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "color",
        "width"
      ],
      "properties": {
        "color": {
          "type": "string",
          "pattern": "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
          "description": "Explicit RGB or RGBA color. Eight-digit colors include alpha; #00000000 is transparent."
        },
        "width": {
          "type": "number",
          "minimum": 0,
          "maximum": 32,
          "description": "Border width in reference pixels; 0 removes this edge."
        },
        "dash": {
          "type": "string",
          "enum": [
            "solid",
            "dash",
            "dot"
          ],
          "description": "Default solid."
        }
      },
      "description": "One explicit cell border."
    },
    "Catalogs": {
      "type": "object",
      "description": "Catalog overrides for the in-document references. Every property is optional. The default catalog for a kind lives at https://www.pptx.gallery/<kind> (e.g. https://www.pptx.gallery/narratives, https://www.pptx.gallery/themes). For each kind, declaring a 'source' replaces the default registry and/or 'records' adds inline records that take precedence over anything fetched from a source.\n\nResolution order for any reference (e.g. narrative, design.theme): inline catalogs.<kind>.records[] \u2192 catalogs.<kind>.source \u2192 default catalog at https://www.pptx.gallery/<kind>. Every reference resolves to the catalog record's 'id' field. References that are themselves URLs or 'pkg:' references skip the catalog lookup and resolve directly.",
      "properties": {
        "narratives": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of narrative templates. Records validate against https://openpresentation.org/schema/opf-narrative/v1. Default source: https://www.pptx.gallery/narratives."
        },
        "themes": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of themes. Records validate against https://openpresentation.org/schema/opf-theme/v1. Default source: https://www.pptx.gallery/themes."
        },
        "colorSchemes": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of color schemes. Records validate against https://openpresentation.org/schema/opf-color-scheme/v1. Default source: https://www.pptx.gallery/color-schemes."
        },
        "fontSchemes": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of font schemes. Records validate against https://openpresentation.org/schema/opf-font-scheme/v1. Default source: https://www.pptx.gallery/font-schemes."
        },
        "languages": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of languages. Records validate against https://openpresentation.org/schema/opf-language/v1. Default source: https://www.pptx.gallery/languages."
        },
        "layouts": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of slide layouts. Records validate against https://openpresentation.org/schema/opf-layout/v1. Default source: https://www.pptx.gallery/layouts."
        },
        "chartTypes": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of chart types. Records validate against https://openpresentation.org/schema/opf-chart-type/v1. Default source: https://www.pptx.gallery/chart-types."
        },
        "tones": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of presentation tones. Records validate against https://openpresentation.org/schema/opf-tone/v1. Default source: https://www.pptx.gallery/tones. Referenced from tone."
        },
        "purposes": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of presentation purposes. Records validate against https://openpresentation.org/schema/opf-purpose/v1. Default source: https://www.pptx.gallery/purposes. Referenced from purpose."
        },
        "audiences": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of presentation audiences. Records validate against https://openpresentation.org/schema/opf-audience/v1. Default source: https://www.pptx.gallery/audiences. Referenced from audience."
        },
        "socialPlatforms": {
          "$ref": "#/$defs/CatalogEntry",
          "description": "Catalog of social-media platforms. Records validate against https://openpresentation.org/schema/opf-social-platform/v1. Default source: https://www.pptx.gallery/social-platforms. Referenced via the property keys of any Socials object (Organization.socials, Speaker.socials)."
        }
      }
    },
    "CatalogEntry": {
      "type": "object",
      "description": "A catalog override for one record kind. 'source' replaces the default registry; 'records' adds inline records that take precedence over anything fetched from a source. Either or both may be provided; both omitted means the kind uses its default catalog.",
      "properties": {
        "source": {
          "oneOf": [
            {
              "$ref": "#/$defs/CatalogSource"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/$defs/CatalogSource"
              },
              "minItems": 1,
              "description": "Ordered search path of sources. The engine tries each in order; first match wins. The default catalog for the kind is appended implicitly at the end."
            }
          ],
          "description": "Single source or an ordered search path of sources. When omitted, the engine falls back to https://www.pptx.gallery/<kind>."
        },
        "records": {
          "type": "array",
          "items": {
            "type": "object"
          },
          "description": "Inline catalog records embedded in this OPF document. Each record validates against the kind's companion schema (e.g. https://openpresentation.org/schema/opf-narrative/v1 for narratives). Inline records win over anything resolved from 'source' and over the default catalog."
        }
      }
    },
    "CatalogSource": {
      "type": "string",
      "description": "Catalog source location. Accepts:\n- A bare URL pointing at a catalog directory (e.g. 'https://acme.com/decks/narratives'); record ids resolve to '<base>/<id>.json'.\n- A URL pointing at an index file (e.g. 'https://acme.com/decks/narratives/index.json'); records are resolved relative to the index file's directory and the index entries describe what's available.\n- A package reference of the form 'pkg:<package>[/<subpath>]'; resolved through a locally-installed package on the engine's package path.",
      "examples": [
        "https://www.pptx.gallery/narratives",
        "https://acme.com/decks/narratives/index.json",
        "pkg:@acme/decks/narratives",
        "pkg:pptx-gallery"
      ]
    },
    "Composition": {
      "type": "object",
      "additionalProperties": false,
      "description": "Portable dynamic composition. Slide fields override the resolved layout. Nested groups arrange their children independently, inheriting only minFontSize and overflow. Explicit promoted regions retain their positions.",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "auto",
            "grid",
            "row",
            "column"
          ],
          "description": "auto chooses a grid from available space and content; grid uses columns; row and column use one horizontal or vertical track."
        },
        "columns": {
          "type": "integer",
          "minimum": 1,
          "maximum": 12,
          "description": "Column count for grid. In auto mode this caps the number of columns."
        },
        "gap": {
          "type": "number",
          "minimum": 0,
          "maximum": 0.1,
          "description": "Space between cells as a fraction of the container short edge (canvas at slide root). Default 0.03333333333333333."
        },
        "padding": {
          "type": "number",
          "minimum": 0,
          "maximum": 0.2,
          "description": "Inset as a fraction of the container short edge. Default 0.08 on a slide, 0 inside a group."
        },
        "weights": {
          "type": "array",
          "minItems": 1,
          "maxItems": 12,
          "items": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 100
          },
          "description": "Relative track sizes: columns for row/grid/auto, rows for column. Omitted tracks have weight 1; extra weights are ignored."
        },
        "minFontSize": {
          "type": "number",
          "minimum": 8,
          "maximum": 32,
          "description": "Minimum readable text size in reference pixels at a 720-pixel canvas short edge. Default 16. Overflow is diagnosed when text cannot fit at this size."
        },
        "overflow": {
          "type": "string",
          "enum": [
            "warn",
            "error"
          ],
          "description": "warn returns diagnostics for content that does not fit; error rejects layout. Content is never silently removed. Default warn."
        }
      }
    }
  }
};
var audience = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-audience/v1",
  "title": "Audience",
  "description": "Schema for audience records in the pptx.gallery library. Each record names an audience archetype (e.g. 'executives', 'engineering-team', 'investors') and carries seniority, technical-fluency, decision-power, and attention-budget hints used by AI-driven generation. Audiences are referenced from OPF documents via audience; the engine resolves the reference against catalogs.audiences (inline) \u2192 catalogs.audiences.source \u2192 the default catalog at https://www.pptx.gallery/audiences. The audience field also accepts free-form strings; this catalog is for engine-aware audience archetypes that carry generation hints.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-audience/v1",
      "description": "Identifies this record as an audience in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this audience via audience. Lowercase kebab-case.",
      "examples": [
        "executives",
        "board",
        "engineering-team",
        "investors",
        "customers",
        "sales-team",
        "marketing-team",
        "all-hands",
        "candidates",
        "regulators"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable audience name shown in pickers.",
      "examples": [
        "Executives",
        "Board of Directors",
        "Engineering Team",
        "Investors",
        "Customers",
        "Sales Team",
        "Marketing Team",
        "All Hands",
        "Candidates",
        "Regulators"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the audience \u2014 who they are and what they care about.",
      "examples": [
        "Senior leaders who need the recommendation up front, the evidence behind it, and the ask.",
        "Practitioners building the system; they want depth, mechanism, and tradeoffs."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the audience archetype and how to address them.",
      "examples": [
        "Executives are time-poor and decision-oriented. Lead with the recommendation, support it with three claims and one number per claim, and end with a clear ask. Avoid drilling into mechanisms unless invited; offer to follow up rather than including everything in the deck."
      ]
    },
    "seniority": {
      "type": "string",
      "enum": [
        "ic",
        "manager",
        "director",
        "vp",
        "c-suite",
        "mixed"
      ],
      "description": "Typical seniority level of the audience. Engines use this as a hint for default depth and pacing."
    },
    "technicalFluency": {
      "type": "string",
      "enum": [
        "low",
        "medium",
        "high",
        "mixed"
      ],
      "description": "Typical technical fluency of the audience. AI generation uses this to decide whether to expand or assume technical terminology."
    },
    "decisionPower": {
      "type": "string",
      "enum": [
        "informational",
        "advisory",
        "decision-maker"
      ],
      "description": "Whether the audience is expected to be informed, to advise, or to actually decide. Shapes the strength of the closing ask."
    },
    "attentionBudgetMinutes": {
      "type": "number",
      "exclusiveMinimum": 0,
      "description": "Realistic upper bound on this audience's focused attention for a single presentation, in minutes. Used as a hint when comparing against duration and the resolved narrative's durationRange."
    },
    "recommendedNarratives": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Soft cross-link: narrative-catalog ids that work well for this audience. Used by picker UIs to suggest narratives once an audience is chosen. Validators warn on unknown ids; never error.",
      "examples": [
        [
          "scqa",
          "board-meeting",
          "qbr"
        ]
      ]
    },
    "recommendedTones": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Soft cross-link: tone-catalog ids that work well for this audience.",
      "examples": [
        [
          "formal",
          "authoritative"
        ]
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "leadership",
          "external"
        ],
        [
          "internal",
          "engineering"
        ],
        [
          "external",
          "customer"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG)."
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views."
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size."
        }
      }
    }
  }
};
var purpose = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-purpose/v1",
  "title": "Purpose",
  "description": "Schema for purpose records in the pptx.gallery library. Each record names a presentation objective such as informing, aligning, persuading, driving a decision, or selling. Purposes are referenced from OPF documents via purpose; the engine resolves the reference against catalogs.purposes (inline) \u2192 catalogs.purposes.source \u2192 the default catalog at https://www.pptx.gallery/purposes. The purpose field also accepts free-form strings and inline Purpose objects.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-purpose/v1",
      "description": "Identifies this record as a purpose in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this purpose via purpose. Lowercase kebab-case.",
      "examples": [
        "inform",
        "decide",
        "align",
        "persuade",
        "educate",
        "report",
        "pitch",
        "sell",
        "plan"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable purpose name shown in pickers.",
      "examples": [
        "Inform",
        "Drive a Decision",
        "Align",
        "Persuade"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the purpose \u2014 what this deck is trying to accomplish."
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing when to use this purpose and how it should shape a deck."
    },
    "outcome": {
      "type": "string",
      "description": "Desired audience outcome after the presentation.",
      "examples": [
        "Approve the recommendation",
        "Understand the status",
        "Adopt the plan"
      ]
    },
    "successCriteria": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Observable signals that the deck accomplished this purpose."
    },
    "recommendedNarratives": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Soft cross-link: narrative-catalog ids that work well for this purpose."
    },
    "recommendedTones": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Soft cross-link: tone-catalog ids that work well for this purpose."
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search."
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG)."
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views."
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size."
        }
      }
    }
  }
};
var tone = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-tone/v1",
  "title": "Tone",
  "description": "Schema for tone records in the pptx.gallery library. Each record names a presentation tone (e.g. 'formal', 'casual', 'inspirational') and carries voice cues, anti-patterns, and sample phrases that AI-driven generation uses to shape output. Tones are referenced from OPF documents via tone; the engine resolves the reference against catalogs.tones (inline) \u2192 catalogs.tones.source \u2192 the default catalog at https://www.pptx.gallery/tones.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-tone/v1",
      "description": "Identifies this record as a tone in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this tone via tone. Lowercase kebab-case.",
      "examples": [
        "formal",
        "casual",
        "inspirational",
        "technical",
        "persuasive",
        "authoritative",
        "conversational"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable tone name shown in pickers.",
      "examples": [
        "Formal",
        "Casual",
        "Inspirational",
        "Technical",
        "Persuasive",
        "Authoritative",
        "Conversational"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the tone \u2014 when to reach for it.",
      "examples": [
        "Polished, restrained voice for board, investor, and regulator audiences.",
        "Warm, plain-spoken voice for internal updates and customer storytelling."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the tone and the kinds of decks it suits.",
      "examples": [
        "Authoritative without being cold. Use third-person constructions, full sentences, and concrete numbers. Avoid hedges and humor that depend on shared in-jokes; rely on clarity and precision to land."
      ]
    },
    "voiceCues": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Short directives that shape AI generation toward this tone. Phrased as imperatives, e.g. 'use second-person', 'favor short sentences', 'lead with the recommendation'.",
      "examples": [
        [
          "Use third person.",
          "Lead with the recommendation, then evidence.",
          "Quote concrete numbers; avoid round-tripping ranges."
        ]
      ]
    },
    "avoid": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Anti-patterns that AI generation should not produce when this tone is active.",
      "examples": [
        [
          "Slang, idioms, or in-jokes.",
          "Hedging language ('maybe', 'sort of', 'I think').",
          "Marketing superlatives ('world-class', 'best-in-class')."
        ]
      ]
    },
    "samplePhrases": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Short example phrases that exemplify this tone. Used by picker UIs and as few-shot examples for AI generation.",
      "examples": [
        [
          "Q4 revenue grew 18% year over year, led by enterprise expansion.",
          "We recommend approving the Series B raise at $30M.",
          "Net retention was 124%; gross retention was 96%."
        ]
      ]
    },
    "recommendedNarratives": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Soft cross-link: narrative-catalog ids this tone pairs well with. Used by picker UIs to suggest narratives once a tone is chosen. Validators warn on unknown ids; never error.",
      "examples": [
        [
          "board-meeting",
          "qbr",
          "scqa"
        ]
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "business",
          "executive"
        ],
        [
          "internal",
          "warm"
        ],
        [
          "motivational",
          "keynote"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG)."
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views."
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size."
        }
      }
    }
  }
};
var theme = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-theme/v1",
  "title": "Theme",
  "description": "Schema for theme records in the pptx.gallery library. Each theme is a small, named bundle that pairs a color scheme, a font scheme, a default theme-controlled background, and a slide size. Themes are referenced from OPF documents via design.theme or design.theme.id; the engine resolves the reference against catalogs.themes (inline) \u2192 catalogs.themes.source \u2192 the default catalog at https://www.pptx.gallery/themes. Inline overrides on design.colorScheme / design.fontScheme / design.background / design.dimensions take precedence over a resolved theme.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-theme/v1",
      "description": "Identifies this record as a theme in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this theme via design.theme. Lowercase kebab-case.",
      "examples": [
        "minimal",
        "classic",
        "dark",
        "bold"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable theme name shown in pickers.",
      "examples": [
        "Minimal",
        "Classic",
        "Dark",
        "Bold"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the theme \u2014 when to reach for it.",
      "examples": [
        "A clean, minimalist theme for professional, straightforward presentations.",
        "A rich dark-mode theme with bold contrast and modern style."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing what the theme looks and feels like and the kinds of decks it suits.",
      "examples": [
        "A clean, minimalistic theme with a focus on simplicity and readability. Ideal for professional, straightforward presentations."
      ]
    },
    "colorScheme": {
      "type": "string",
      "description": "Catalog reference to the theme's default color scheme \u2014 resolved against catalogs.colorSchemes the same way design.colorScheme or design.colorScheme.id is. Accepts a bare id, HTTPS URL, or 'pkg:' reference.",
      "examples": [
        "cool-horizon",
        "boost",
        "burnt-orange"
      ]
    },
    "fontScheme": {
      "type": "string",
      "description": "Catalog reference to the theme's default font scheme \u2014 resolved against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id is. Accepts a bare id, HTTPS URL, or 'pkg:' reference.",
      "examples": [
        "aptos",
        "tenorite",
        "seaford",
        "impact"
      ]
    },
    "background": {
      "$ref": "#/$defs/ThemeBackground"
    },
    "dimensions": {
      "type": "string",
      "enum": [
        "16:9",
        "4:3",
        "16:10",
        "letter",
        "a4",
        "widescreen",
        "standard"
      ],
      "description": "Default slide size for this theme. Accepts the same preset values as design.dimensions.preset.",
      "examples": [
        "16:9",
        "4:3",
        "16:10",
        "letter",
        "a4",
        "widescreen",
        "standard"
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "minimal",
          "professional"
        ],
        [
          "bold",
          "high-impact"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/themes/minimal.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/themes/minimal.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/themes/minimal.svg"
          ]
        }
      }
    }
  },
  "$defs": {
    "ThemeBackgroundSlot": {
      "type": "string",
      "description": "PowerPoint theme-controlled slide background slot from the active color scheme. These are slots, not assumptions about actual colors: light1 is usually white and dark1 is usually black by convention, but the color scheme controls the real values.",
      "enum": [
        "light1",
        "light2",
        "dark1",
        "dark2"
      ]
    },
    "ThemeBackground": {
      "type": "object",
      "description": "Theme-controlled PowerPoint slide background. The slot is resolved through the active color scheme and remains theme-aware.",
      "required": [
        "type",
        "slot"
      ],
      "properties": {
        "type": {
          "type": "string",
          "const": "theme",
          "description": "Theme-controlled background fill."
        },
        "slot": {
          "$ref": "#/$defs/ThemeBackgroundSlot"
        }
      }
    }
  }
};
var layout = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-layout/v1",
  "title": "Slide Layout",
  "description": "Schema for slide-layout records in the pptx.gallery library. Each record describes a semantic slide layout \u2014 what regions it exposes and what content kinds those regions are intended to hold. Layouts are referenced from OPF documents via Slide.layout; the engine resolves the reference against catalogs.layouts (inline) \u2192 catalogs.layouts.source \u2192 the default catalog at https://www.pptx.gallery/layouts. Free-form custom layout names that don't resolve through any catalog fall through to engine-defined layouts.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-layout/v1",
      "description": "Identifies this record as a slide layout in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this layout via Slide.layout. Lowercase kebab-case.",
      "examples": [
        "title",
        "title-subtitle",
        "chart-1x",
        "image-bleed"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable layout name shown in layout pickers.",
      "examples": [
        "Title",
        "Title Subtitle",
        "Chart 1x",
        "Image Bleed"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the layout \u2014 when to reach for it.",
      "examples": [
        "Slide title aligned left over a single content area \u2014 flexible workhorse layout.",
        "Title plus a single chart on the left and supporting copy on the right."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the layout structure and ideal use cases.",
      "examples": [
        "Two equal-width columns under a left-aligned slide title. Use when comparing two ideas, before/after pairs, or paired text + image content."
      ]
    },
    "contentType": {
      "type": "string",
      "enum": [
        "Title",
        "Text",
        "List",
        "Image",
        "Number",
        "Chart"
      ],
      "description": "Primary kind of content the layout holds. Drives pickers and AI placement decisions."
    },
    "contentMultiple": {
      "type": "string",
      "enum": [
        "None",
        "1x",
        "2x",
        "3x",
        "4x",
        "5x",
        "6x"
      ],
      "description": "How many parallel content blocks the layout exposes ('2x' = two-column, '3x' = three-up, etc.)."
    },
    "contentAlignment": {
      "type": "string",
      "enum": [
        "None",
        "Left",
        "Center"
      ],
      "description": "Default horizontal alignment of the content area."
    },
    "contentBox": {
      "type": "boolean",
      "description": "Whether the content area is rendered inside a visible box / card.",
      "examples": [
        false,
        true
      ]
    },
    "contentTypeChartPrimary": {
      "type": "string",
      "enum": [
        "None",
        "Top",
        "Bottom",
        "Left",
        "Right"
      ],
      "description": "For chart layouts, where the primary chart sits relative to the rest of the content."
    },
    "contentTypeImageFill": {
      "type": "string",
      "enum": [
        "None",
        "Crop",
        "Fit"
      ],
      "description": "For image layouts, how the image fills its slot."
    },
    "contentTypeListBullet": {
      "type": "string",
      "enum": [
        "None",
        "Character",
        "Image"
      ],
      "description": "For list layouts, how bullets are rendered."
    },
    "contentTypeListHeading": {
      "type": "boolean",
      "description": "For list layouts, whether each list item carries a heading.",
      "examples": [
        false,
        true
      ]
    },
    "slideTag": {
      "type": "boolean",
      "description": "Whether the layout includes a small slide-level tag / label region above or near the title.",
      "examples": [
        false,
        true
      ]
    },
    "slideTitle": {
      "type": "boolean",
      "description": "Whether the layout includes a slide title region.",
      "examples": [
        true,
        false
      ]
    },
    "slideSubtitle": {
      "type": "boolean",
      "description": "Whether the layout includes a slide-level subtitle or supporting-description region. When placeholders is present, this is true exactly when the layout exposes a placeholder with type 'subtitle'.",
      "examples": [
        false,
        true
      ]
    },
    "slideTitleAlignment": {
      "type": "string",
      "enum": [
        "None",
        "Left",
        "Center"
      ],
      "description": "Horizontal alignment of the slide title region."
    },
    "slideImage": {
      "type": "boolean",
      "description": "Whether the layout includes a dedicated slide-level image region (separate from any content image).",
      "examples": [
        false,
        true
      ]
    },
    "slideImageAlignment": {
      "type": "string",
      "enum": [
        "None",
        "Top",
        "Bottom",
        "Left",
        "Right",
        "Background"
      ],
      "description": "Where the slide-level image sits relative to the content."
    },
    "slideLayoutDirection": {
      "type": "string",
      "enum": [
        "None",
        "Horizontal",
        "Vertical"
      ],
      "description": "Axis along which the layout's primary regions are arranged."
    },
    "placeholders": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/Placeholder"
      },
      "description": "Ordered regions the layout exposes. The engine fills 'title', 'subtitle', and 'tag' placeholders from Slide.title, Slide.subtitle, and Slide.tag. Other placeholders are content-kind hints for renderers and pickers. Slide content itself lives either in root payload fields or promoted region keys on Slide. Chrome \u2014 slide number, footer, date \u2014 is not included here; it is owned by Design.header / Design.footer."
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "title",
          "minimal"
        ],
        [
          "chart",
          "kpi"
        ],
        [
          "two-column",
          "comparison"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/layouts/title-left.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/layouts/title-left.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/layouts/title-left.svg"
          ]
        }
      }
    },
    "composition": {
      "$ref": "#/$defs/Composition"
    }
  },
  "$defs": {
    "Placeholder": {
      "type": "object",
      "required": [
        "type"
      ],
      "description": "A single region inside a slide layout. Title, subtitle, and tag placeholders bind to the corresponding Slide fields; other placeholders describe the intended content kind for that region. The array order in the surrounding 'placeholders' field preserves layout region order.",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "title",
            "subtitle",
            "tag",
            "text",
            "list",
            "chart",
            "picture",
            "table",
            "media",
            "diagram",
            "code"
          ],
          "description": "OPF placeholder kind. 'text' and 'list' are flexible textual content regions. The named kinds describe a specific content role used by pickers, AI generation, and engine defaulting."
        }
      }
    },
    "Composition": {
      "type": "object",
      "additionalProperties": false,
      "description": "Portable dynamic composition. Slide fields override the resolved layout. Nested groups arrange their children independently, inheriting only minFontSize and overflow. Explicit promoted regions retain their positions.",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "auto",
            "grid",
            "row",
            "column"
          ],
          "description": "auto chooses a grid from available space and content; grid uses columns; row and column use one horizontal or vertical track."
        },
        "columns": {
          "type": "integer",
          "minimum": 1,
          "maximum": 12,
          "description": "Column count for grid. In auto mode this caps the number of columns."
        },
        "gap": {
          "type": "number",
          "minimum": 0,
          "maximum": 0.1,
          "description": "Space between cells as a fraction of the container short edge (canvas at slide root). Default 0.03333333333333333."
        },
        "padding": {
          "type": "number",
          "minimum": 0,
          "maximum": 0.2,
          "description": "Inset as a fraction of the container short edge. Default 0.08 on a slide, 0 inside a group."
        },
        "weights": {
          "type": "array",
          "minItems": 1,
          "maxItems": 12,
          "items": {
            "type": "number",
            "exclusiveMinimum": 0,
            "maximum": 100
          },
          "description": "Relative track sizes: columns for row/grid/auto, rows for column. Omitted tracks have weight 1; extra weights are ignored."
        },
        "minFontSize": {
          "type": "number",
          "minimum": 8,
          "maximum": 32,
          "description": "Minimum readable text size in reference pixels at a 720-pixel canvas short edge. Default 16. Overflow is diagnosed when text cannot fit at this size."
        },
        "overflow": {
          "type": "string",
          "enum": [
            "warn",
            "error"
          ],
          "description": "warn returns diagnostics for content that does not fit; error rejects layout. Content is never silently removed. Default warn."
        }
      }
    }
  }
};
var chartType = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-chart-type/v1",
  "title": "Chart Type",
  "description": "Schema for chart-type records in the pptx.gallery catalog. Each record describes a named chart variant, its Open XML mapping, its series/category cardinality, the column structure of the underlying workbook, and a small sample dataset suitable for previews. Chart types are referenced from OPF chart content payloads; the engine resolves the reference against catalogs.chartTypes (inline) -> catalogs.chartTypes.source -> the default catalog at https://www.pptx.gallery/chart-types.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "$schema",
    "id",
    "name",
    "mappings"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-chart-type/v1",
      "description": "Identifies this record as a chart type in the open presentation catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this chart type. Lowercase kebab-case. Chart type ids may start with a digit (e.g., '100pct-stacked-column', '3d-column') to mirror conventional chart naming.",
      "examples": [
        "column",
        "clustered-column",
        "stacked-column",
        "doughnut",
        "bullet-column",
        "100pct-stacked-column"
      ]
    },
    "name": {
      "type": "string",
      "description": "Stable display/programmatic name for this chart type.",
      "examples": [
        "COLUMN",
        "CLUSTERED_COLUMN",
        "DOUGHNUT",
        "BULLET_COLUMN"
      ]
    },
    "label": {
      "type": "string",
      "description": "Human-readable label shown in chart pickers.",
      "examples": [
        "Column",
        "Clustered Column",
        "Doughnut",
        "Bullet Column"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning: when to reach for this chart variant.",
      "examples": [
        "Single-series vertical column chart for comparing values across categories.",
        "Bullet chart that benchmarks one value against ranked threshold bands."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the chart and ideal use cases.",
      "examples": [
        "Use a clustered column when you want to compare a small number of series across the same categories \u2014 e.g., revenue by quarter for two product lines. Best with 2\u20134 series and \u226412 categories."
      ]
    },
    "mappings": {
      "$ref": "#/$defs/ChartTypeMappings",
      "description": "Canonical and optional renderer-specific mappings used by engines to render this chart type."
    },
    "group": {
      "type": "string",
      "description": "Top-level grouping in the chart picker (column, bar, line, area, pie, radar, etc.).",
      "examples": [
        "Column",
        "Bar",
        "Line",
        "Area",
        "Pie",
        "Radar",
        "Histogram",
        "XY (Scatter)",
        "Treemap",
        "Bullet",
        "Sparkline",
        "Map",
        "Other"
      ]
    },
    "groupSort": {
      "type": "integer",
      "minimum": 0,
      "description": "Display ordering hint within the chart group.",
      "examples": [
        1,
        2,
        10
      ]
    },
    "complexity": {
      "type": "string",
      "enum": [
        "simple",
        "calculated",
        "hierarchical",
        "normalized"
      ],
      "description": "Shape of the underlying data: a flat series ('simple'), one with engine-side calculation ('calculated'), parent-child rows ('hierarchical'), or pre-normalized rows ('normalized')."
    },
    "series": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of data series this chart type expects.",
      "examples": [
        1,
        2,
        3,
        4
      ]
    },
    "categories": {
      "type": "integer",
      "minimum": 0,
      "description": "Number of category labels this chart type expects on the primary axis.",
      "examples": [
        4,
        6,
        8,
        12
      ]
    },
    "seriesGroups": {
      "type": "integer",
      "minimum": 1,
      "description": "Number of series groups (axis bands) this chart type uses; >1 for combo or banded charts.",
      "examples": [
        1,
        2,
        3
      ]
    },
    "useSecondaryCategories": {
      "type": "boolean",
      "description": "Whether the chart type uses a secondary category axis.",
      "examples": [
        false,
        true
      ]
    },
    "workbookRange": {
      "type": "string",
      "description": "A1 reference to the source range in the embedded workbook.",
      "examples": [
        "Sheet1!$A$1:$I$2",
        "Sheet1!$A$1:$G$3"
      ]
    },
    "columns": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Column header names of the embedded workbook, in left-to-right order.",
      "examples": [
        [
          "Series 1",
          "Value"
        ],
        [
          "Series 1",
          "Value 1",
          "Value 2"
        ]
      ]
    },
    "dataColumns": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/ChartDataColumn"
      },
      "description": "Per-column metadata describing the role and position of each column in the workbook source.",
      "examples": [
        [
          {
            "name": "Series 1",
            "role": "categoryLabel",
            "type": "string",
            "position": "row0_col0"
          },
          {
            "name": "Value 1",
            "role": "series",
            "type": "number",
            "position": "row1_col0"
          },
          {
            "name": "Value 2",
            "role": "series",
            "type": "number",
            "position": "row2_col0"
          }
        ]
      ]
    },
    "helperColumns": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Optional auxiliary column names used by calculated or banded charts (e.g., 'Excellent', 'Good', 'Fair', 'Poor' for a bullet chart).",
      "examples": [
        [
          "Excellent",
          "Good",
          "Fair",
          "Poor"
        ],
        [
          "Band"
        ]
      ]
    },
    "sampleData": {
      "$ref": "#/$defs/ChartSampleData",
      "description": "Inline sample dataset for previews and pickers.",
      "examples": [
        {
          "headers": [
            "Series 1",
            "Q1 2024",
            "Q2 2024",
            "Q3 2024",
            "Q4 2024"
          ],
          "rows": [
            [
              "Value",
              93810,
              24592,
              13278,
              46048
            ]
          ]
        }
      ]
    },
    "slideNumber": {
      "type": "integer",
      "minimum": 1,
      "description": "Source slide number in the original chart-gallery deck. Carried for traceability.",
      "examples": [
        1,
        2,
        48
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "column",
          "comparison"
        ],
        [
          "bullet",
          "kpi",
          "benchmark"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/chart-types/clustered-column.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/chart-types/clustered-column.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/chart-types/clustered-column.svg"
          ]
        }
      }
    }
  },
  "$defs": {
    "ChartTypeMappings": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "openxml"
      ],
      "properties": {
        "openxml": {
          "$ref": "#/$defs/OpenXmlChartMapping",
          "description": "Canonical mapping to Open XML chart structures."
        },
        "renderers": {
          "type": "object",
          "description": "Optional renderer-specific mappings. Keys are renderer ids; values are intentionally opaque to OPF.",
          "additionalProperties": {
            "type": "object",
            "additionalProperties": true
          }
        }
      }
    },
    "OpenXmlChartMapping": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "element": {
          "type": "string",
          "description": "Primary Open XML chart element or extension chart element, such as 'barChart', 'lineChart', 'pieChart', 'treemapChart', or 'waterfallChart'.",
          "examples": [
            "barChart",
            "lineChart",
            "pieChart"
          ]
        },
        "barDir": {
          "type": "string",
          "enum": [
            "bar",
            "col"
          ],
          "description": "Bar direction for Open XML barChart mappings."
        },
        "grouping": {
          "type": "string",
          "enum": [
            "standard",
            "clustered",
            "stacked",
            "percentStacked"
          ],
          "description": "Open XML chart grouping value when the chart family supports grouping."
        },
        "marker": {
          "type": "boolean",
          "description": "Whether the chart type expects visible data markers."
        },
        "radarStyle": {
          "type": "string",
          "enum": [
            "standard",
            "marker",
            "filled"
          ],
          "description": "Open XML radarStyle value for radarChart mappings."
        },
        "scatterStyle": {
          "type": "string",
          "enum": [
            "line",
            "lineMarker",
            "marker",
            "smooth",
            "smoothMarker"
          ],
          "description": "Open XML scatterStyle value for scatterChart mappings."
        },
        "composition": {
          "type": "string",
          "enum": [
            "single",
            "mixed",
            "extension"
          ],
          "description": "Whether the chart maps to one standard chart element, multiple combined chart elements, or an Open XML extension chart."
        },
        "extension": {
          "type": "string",
          "description": "Optional Open XML extension namespace or element hint for extension charts.",
          "examples": [
            "cx:treemapChart",
            "cx:waterfallChart"
          ]
        },
        "series": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/OpenXmlChartMapping"
          },
          "description": "Open XML chart elements used by mixed/composite chart types."
        },
        "notes": {
          "type": "string",
          "description": "Short implementation note for mappings that need renderer interpretation."
        }
      }
    },
    "ChartDataColumn": {
      "type": "object",
      "description": "One column of the embedded chart workbook, annotated with its role and grid position.",
      "required": [
        "name",
        "role",
        "type"
      ],
      "properties": {
        "name": {
          "type": "string",
          "description": "Column header name (e.g. 'Series 1', 'Value', 'Level1', 'Level2').",
          "examples": [
            "Series 1",
            "Value",
            "Level1",
            "Level2"
          ]
        },
        "role": {
          "type": "string",
          "enum": [
            "categoryLabel",
            "series",
            "helper"
          ],
          "description": "Role this column plays: a category label (axis tick), a series (plotted values), or a helper (calculated/auxiliary)."
        },
        "type": {
          "type": "string",
          "enum": [
            "string",
            "number"
          ],
          "description": "Cell value type for the column."
        },
        "position": {
          "type": "string",
          "pattern": "^row[0-9]+_col[0-9]+$",
          "description": "Grid position of the column header in the source workbook, as 'row<N>_col<M>' (zero-indexed).",
          "examples": [
            "row0_col0",
            "row1_col0",
            "row2_col0"
          ]
        }
      }
    },
    "ChartSampleData": {
      "type": "object",
      "description": "Inline sample dataset for previews. Mirrors a small workbook with header row plus data rows.",
      "required": [
        "headers",
        "rows"
      ],
      "properties": {
        "headers": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Header row labels. The first cell typically labels the series column; the rest are category labels.",
          "examples": [
            [
              "Series 1",
              "Q1 2024",
              "Q2 2024",
              "Q3 2024",
              "Q4 2024",
              "Q1 2025",
              "Q2 2025",
              "Q3 2025",
              "Q4 2025"
            ]
          ]
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": [
                "string",
                "number"
              ]
            }
          },
          "description": "Two-dimensional sample data. Each row aligns by index with the headers \u2014 first cell is the row label, remaining cells are values.",
          "examples": [
            [
              [
                "Value",
                93810,
                24592,
                13278,
                46048,
                42098,
                39256,
                28289,
                23434
              ]
            ],
            [
              [
                "Value 1",
                98696,
                81482,
                21395,
                87397
              ],
              [
                "Value 2",
                38657,
                40495,
                76237,
                88907
              ]
            ]
          ]
        }
      }
    }
  }
};
var narrative = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-narrative/v1",
  "title": "Narrative Template",
  "description": "Schema for narrative template files in the openpresentation.org catalog. Each template describes a named story arc (e.g. 'problem-solution', 'scqa') as an ordered list of beats. Templates are referenced from OPF documents via narrative \u2014 either as a bare id string (e.g. 'classic-story') or as an inline object whose shape matches this schema (sans '$schema').",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name",
    "beats"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-narrative/v1"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this template, e.g. 'problem-solution'. Lowercase kebab-case."
    },
    "name": {
      "type": "string",
      "description": "Human-readable template name, e.g. 'Problem \u2192 Solution'."
    },
    "summary": {
      "type": "string",
      "description": "One-sentence description of when and why to use this narrative."
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the narrative arc and ideal use cases. Used by AI-driven generation to seed deck-level direction.",
      "examples": [
        "Open with the cost of slow agentic workflows, contrast with what becomes possible at sub-second latency, then walk through our architecture and benchmark results, ending with a concrete adoption ask."
      ]
    },
    "audienceFit": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Audiences this narrative works well for, e.g. ['executives', 'investors', 'customers']."
    },
    "durationRange": {
      "type": "object",
      "description": "Typical talk-length window this narrative suits.",
      "properties": {
        "minMinutes": {
          "type": "number",
          "exclusiveMinimum": 0
        },
        "maxMinutes": {
          "type": "number",
          "exclusiveMinimum": 0
        }
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search, e.g. ['business', 'pitch', 'internal']."
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/narratives/classic-story.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/narratives/classic-story.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/narratives/classic-story.svg"
          ]
        }
      }
    },
    "beats": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/Beat"
      },
      "description": "Ordered list of beats that make up the narrative arc."
    }
  },
  "$defs": {
    "Beat": {
      "type": "object",
      "description": "A single narrative beat \u2014 a labeled segment of the story arc with a specific dramatic purpose. Mirrors the NarrativeBeat definition in opf.schema.json so library entries and inline OPF beats are interchangeable.",
      "required": [
        "id",
        "name"
      ],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Stable slug used by Slide.beat to reference this beat. Lowercase kebab-case.",
          "examples": [
            "opening",
            "problem",
            "evidence",
            "ask",
            "next-steps"
          ]
        },
        "name": {
          "type": "string",
          "description": "Human-readable beat name, e.g. 'The Problem'.",
          "examples": [
            "Opening",
            "The Problem",
            "Why Now",
            "The Ask"
          ]
        },
        "description": {
          "type": "string",
          "description": "Curator-written prose that explains what this beat should accomplish.",
          "examples": [
            "Quantify the pain customers feel today, with one striking stat the audience can repeat afterward."
          ]
        },
        "instructions": {
          "type": "string",
          "description": "Short author-facing instruction for the beat \u2014 typically one phrase. Complements 'description' with a concise directive.",
          "examples": [
            "Capture audience attention",
            "Introduce problem",
            "Detail implementation",
            "Inspire & conclude"
          ]
        },
        "slideCount": {
          "type": "integer",
          "minimum": 1,
          "description": "Optional explicit slide count for this beat. Defaults to 1 when omitted; values >1 are reserved for beats that intentionally span multiple slides. Prefer decomposing a heavy beat into multiple beats over setting a high slideCount. The validator emits a warning if the deck's actual count differs significantly.",
          "examples": [
            1,
            2,
            3
          ]
        },
        "slideType": {
          "type": "string",
          "enum": [
            "text",
            "list",
            "image",
            "shape",
            "chart",
            "table",
            "video",
            "code",
            "metric",
            "quote",
            "timeline"
          ],
          "description": "Default content kind for the beat's slide. Mirrors ContentPayload.type and helps engines choose a sensible layout when only the beat is specified."
        },
        "layoutHint": {
          "type": "string",
          "description": "Suggested layout id for the beat's opening slide, e.g. 'section-divider', 'title-slide', 'text-left'. Resolves the same way as Slide.layout \u2014 against catalogs.layouts and the default catalog at https://www.pptx.gallery/layouts.",
          "examples": [
            "section-divider",
            "title-slide",
            "title-left",
            "two-column",
            "text-left"
          ]
        },
        "thoughtCues": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Optional speaker or thinking cues attached to the beat. Surfaced in presenter notes.",
          "examples": [
            [
              "What pain is the audience feeling right now?",
              "Why hasn't anyone solved this yet?"
            ]
          ]
        }
      }
    }
  }
};
var socialPlatform = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-social-platform/v1",
  "title": "Social Platform",
  "description": "Schema for social-platform records in the pptx.gallery library. Each record describes a single social-media platform \u2014 its base URL, profile-URL pattern, handle prefix, brand color, and themed icons. Records are referenced from OPF documents indirectly: the property keys of any Socials object (Organization.socials, Speaker.socials) match record ids, and renderers use the catalog record to format URLs and pick icons. The engine resolves references against catalogs.socialPlatforms (inline) \u2192 catalogs.socialPlatforms.source \u2192 the default catalog at https://www.pptx.gallery/social-platforms.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-social-platform/v1",
      "description": "Identifies this record as a social-platform entry in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this platform \u2014 appears as a property key on Socials objects. Lowercase kebab-case.",
      "examples": [
        "linkedin",
        "x",
        "github",
        "youtube",
        "instagram",
        "facebook",
        "tiktok",
        "threads",
        "mastodon",
        "bluesky"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable platform name shown in pickers and footers.",
      "examples": [
        "LinkedIn",
        "X",
        "GitHub",
        "YouTube",
        "Instagram",
        "Facebook",
        "TikTok",
        "Threads",
        "Mastodon",
        "Bluesky"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the platform \u2014 what it's used for and who's on it.",
      "examples": [
        "Professional social network for individuals and companies.",
        "Real-time microblog for news, opinions, and discussion."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the platform and any rendering conventions (e.g., handle prefixes, distributed instances).",
      "examples": [
        "LinkedIn distinguishes between member profiles ('/in/<handle>') and company pages ('/company/<handle>'). Renderers should pick the appropriate URL pattern based on whether the parent is an Organization or a Speaker."
      ]
    },
    "baseUrl": {
      "type": "string",
      "format": "uri",
      "description": "Canonical base URL of the platform \u2014 used as the prefix when normalizing handles to full URLs.",
      "examples": [
        "https://linkedin.com",
        "https://x.com",
        "https://github.com",
        "https://youtube.com"
      ]
    },
    "profileUrlPattern": {
      "type": "string",
      "description": "URL pattern for individual member profiles. Use '{handle}' as the placeholder for the handle (with the prefix already stripped).",
      "examples": [
        "https://linkedin.com/in/{handle}",
        "https://x.com/{handle}",
        "https://github.com/{handle}",
        "https://youtube.com/@{handle}"
      ]
    },
    "companyUrlPattern": {
      "type": "string",
      "description": "Optional URL pattern for organization / company pages, when the platform distinguishes them from member profiles. Use '{handle}' as the placeholder.",
      "examples": [
        "https://linkedin.com/company/{handle}",
        "https://github.com/{handle}",
        "https://facebook.com/{handle}"
      ]
    },
    "handlePrefix": {
      "type": "string",
      "description": "Conventional prefix character displayed before the handle (e.g. '@' for X / Mastodon / Threads / TikTok). Empty string when no prefix is used. Renderers strip it before substituting into URL patterns.",
      "examples": [
        "@",
        ""
      ]
    },
    "handleExample": {
      "type": "string",
      "description": "Example handle in its conventional rendered form, used by picker UIs and validation hints.",
      "examples": [
        "alice-chen",
        "@alicechen",
        "alicechen",
        "alice.bsky.social",
        "@alice@hachyderm.io"
      ]
    },
    "brandColor": {
      "type": "string",
      "description": "Brand color (hex) used for branded icon chips, link styling, or section accents.",
      "examples": [
        "#0A66C2",
        "#000000",
        "#181717",
        "#FF0000"
      ]
    },
    "icon": {
      "type": "string",
      "description": "Default icon source. Accepts an HTTPS URL, data URI, relative path, or asset reference. Used as the fallback when a themed (Light/Dark) variant isn't set.",
      "examples": [
        "https://www.pptx.gallery/social-platforms/linkedin.svg",
        "./assets/social-platforms/linkedin.svg",
        "asset:social-linkedin"
      ]
    },
    "iconLight": {
      "type": "string",
      "description": "Light-colored icon variant intended for rendering on dark backgrounds.",
      "examples": [
        "https://www.pptx.gallery/social-platforms/linkedin-light.svg",
        "./assets/social-platforms/linkedin-light.svg"
      ]
    },
    "iconDark": {
      "type": "string",
      "description": "Dark-colored icon variant intended for rendering on light backgrounds.",
      "examples": [
        "https://www.pptx.gallery/social-platforms/linkedin-dark.svg",
        "./assets/social-platforms/linkedin-dark.svg"
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "professional",
          "default"
        ],
        [
          "microblog",
          "news"
        ],
        [
          "developer",
          "code"
        ],
        [
          "video"
        ],
        [
          "decentralized"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG)."
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views."
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size."
        }
      }
    }
  }
};
var language = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-language/v1",
  "title": "Language",
  "description": "Schema for language records in the pptx.gallery library. Each record names a presentation language, carries a BCP-47 language tag, and pairs it with sensible default font schemes for PowerPoint and Google Slides output. Languages are referenced from OPF documents via language; the engine resolves the reference against catalogs.languages (inline) \u2192 catalogs.languages.source \u2192 the default catalog at https://www.pptx.gallery/languages. The presentation language field also accepts BCP-47 tags directly or inline Language objects for engine-aware language records that carry default-font hints.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name",
    "bcp47"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-language/v1",
      "description": "Identifies this record as a language in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this language via language. Lowercase kebab-case.",
      "examples": [
        "english",
        "spanish",
        "japanese",
        "chinese-simplified"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable language name.",
      "examples": [
        "English",
        "Spanish",
        "Japanese",
        "Chinese (simplified)"
      ]
    },
    "code": {
      "type": "string",
      "description": "ISO 639-3 (or 639-2) three-letter language code. Carried for engines that prefer ISO codes.",
      "examples": [
        "ENG",
        "SPA",
        "FRA",
        "JPN",
        "CHI"
      ]
    },
    "bcp47": {
      "type": "string",
      "description": "BCP-47 language tag for this record. Use 'en-GB' for UK English; 'en-UK' is not a valid BCP-47 region form.",
      "examples": [
        "en",
        "en-US",
        "en-GB",
        "es-MX",
        "ja-JP",
        "zh-Hans"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "ltr",
        "rtl"
      ],
      "description": "Base text direction for the language.",
      "examples": [
        "ltr",
        "rtl"
      ]
    },
    "script": {
      "type": "string",
      "description": "ISO 15924 script code when the writing system should be explicit.",
      "examples": [
        "Latn",
        "Arab",
        "Cyrl",
        "Hans",
        "Hant"
      ]
    },
    "fontScheme": {
      "type": "string",
      "description": "Default font-scheme id for this language when targeting PowerPoint output. Resolves against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id does.",
      "examples": [
        "aptos",
        "microsoft-yahei",
        "nirmala-ui"
      ]
    },
    "googleFontScheme": {
      "type": "string",
      "description": "Default font-scheme id for this language when targeting Google Slides output. Resolves against catalogs.fontSchemes the same way design.fontScheme or design.fontScheme.id does.",
      "examples": [
        "roboto",
        "noto-sans",
        "noto-sans-sc"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence note about coverage or font defaults.",
      "examples": [
        "English language preset using a Latin-script font scheme.",
        "Japanese language preset paired with a Microsoft YaHei East-Asian scheme."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the language record and any font-pairing rationale.",
      "examples": [
        "English (US) preset. Defaults to Aptos for PowerPoint output and Roboto for Google Slides output. Use this entry as a baseline; override fontScheme on individual decks when brand fonts differ."
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "latin",
          "default"
        ],
        [
          "east-asian"
        ],
        [
          "complex-script",
          "rtl"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/languages/english.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/languages/english.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/languages/english.svg"
          ]
        }
      }
    }
  }
};
var colorScheme = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-color-scheme/v1",
  "title": "Color Scheme",
  "description": "Schema for color-scheme records in the pptx.gallery library. Each scheme is a named palette with the twelve PowerPoint color slots (six accents, two darks, two lights, plus hyperlink and followed-hyperlink), suitable for being mapped directly into OOXML theme XML. Color schemes are referenced from OPF documents via design.colorScheme or design.colorScheme.id; the engine resolves the reference against catalogs.colorSchemes (inline) -> catalogs.colorSchemes.source -> the default catalog at https://www.pptx.gallery/color-schemes. Slot overrides on design.colorScheme take precedence over the resolved scheme.\n\nThe slot fields here mirror the inline-override fields on the in-document ColorScheme type (in opf.schema.json), so library entries and inline OPF overrides are interchangeable.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-color-scheme/v1",
      "description": "Identifies this record as a color scheme in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this color scheme. Lowercase kebab-case.",
      "examples": [
        "cool-horizon",
        "boost",
        "burnt-orange",
        "forest-green"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable scheme name shown in pickers.",
      "examples": [
        "Cool Horizon",
        "Boost",
        "Burnt Orange",
        "Forest Green"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the palette \u2014 what mood it evokes and where to use it.",
      "examples": [
        "Cool blue-green palette tuned for B2B SaaS and finance decks.",
        "High-energy warm palette built around burnt-orange accents."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the palette and its intended use.",
      "examples": [
        "A balanced cool-toned scheme: a deep navy dark slot pairs with mid-saturation blues and a teal accent for charts and callouts. Works well on both light and dark backgrounds."
      ]
    },
    "accent1": {
      "type": "string",
      "description": "Accent 1 color (hex). Mirrors the OOXML accent1 slot.",
      "examples": [
        "#2874A6",
        "#FD3223",
        "#F77F00"
      ]
    },
    "accent2": {
      "type": "string",
      "description": "Accent 2 color (hex). Mirrors the OOXML accent2 slot.",
      "examples": [
        "#1B4F72",
        "#0308DB",
        "#D62828"
      ]
    },
    "accent3": {
      "type": "string",
      "description": "Accent 3 color (hex). Mirrors the OOXML accent3 slot.",
      "examples": [
        "#5499C7",
        "#4F4955",
        "#003049"
      ]
    },
    "accent4": {
      "type": "string",
      "description": "Accent 4 color (hex). Mirrors the OOXML accent4 slot.",
      "examples": [
        "#7BDBB2",
        "#A1DB30",
        "#FCBF49"
      ]
    },
    "accent5": {
      "type": "string",
      "description": "Accent 5 color (hex). Mirrors the OOXML accent5 slot.",
      "examples": [
        "#3AC67A",
        "#0682FE",
        "#EAE2B7"
      ]
    },
    "accent6": {
      "type": "string",
      "description": "Accent 6 color (hex). Mirrors the OOXML accent6 slot.",
      "examples": [
        "#24A89E",
        "#FC03BE",
        "#BFBFBF"
      ]
    },
    "dark1": {
      "type": "string",
      "description": "Dark 1 color (hex). Typically the deepest neutral; OOXML dark1.",
      "examples": [
        "#000000"
      ]
    },
    "dark2": {
      "type": "string",
      "description": "Dark 2 color (hex). Secondary dark; OOXML dark2.",
      "examples": [
        "#011842"
      ]
    },
    "light1": {
      "type": "string",
      "description": "Light 1 color (hex). Typically the slide canvas; OOXML lt1.",
      "examples": [
        "#FFFFFF"
      ]
    },
    "light2": {
      "type": "string",
      "description": "Light 2 color (hex). Secondary light surface; OOXML lt2.",
      "examples": [
        "#F0F0F0"
      ]
    },
    "hyperlink": {
      "type": "string",
      "description": "Hyperlink color (hex). OOXML hlink.",
      "examples": [
        "#0563C1"
      ]
    },
    "followedHyperlink": {
      "type": "string",
      "description": "Followed-hyperlink color (hex). OOXML folHlink.",
      "examples": [
        "#954F72"
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "corporate",
          "blue",
          "calm"
        ],
        [
          "bold",
          "warm",
          "high-energy"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/color-schemes/cool-horizon.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/color-schemes/cool-horizon.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/color-schemes/cool-horizon.svg"
          ]
        }
      }
    }
  }
};
var fontScheme = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresentation.org/schema/opf-font-scheme/v1",
  "title": "Font Scheme",
  "description": "Schema for font-scheme records in the pptx.gallery library. Each scheme pairs a major (heading) and minor (body) font family in the OOXML majorFont/minorFont sense, scoped to a target app (PowerPoint or Google Slides) and a language family (Latin, East Asian, or Complex Script). Font schemes are referenced from OPF documents via design.fontScheme or design.fontScheme.id; the engine resolves the reference against catalogs.fontSchemes (inline) \u2192 catalogs.fontSchemes.source \u2192 the default catalog at https://www.pptx.gallery/font-schemes. Role overrides on design.fontScheme (heading, body, accent, code) take precedence over the resolved scheme.",
  "type": "object",
  "required": [
    "$schema",
    "id",
    "name",
    "major",
    "minor"
  ],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openpresentation.org/schema/opf-font-scheme/v1",
      "description": "Identifies this record as a font scheme in the openpresentation.org catalog."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stable slug used by OPF documents to reference this font scheme. Lowercase kebab-case.",
      "examples": [
        "aptos",
        "tenorite",
        "seaford",
        "noto-sans",
        "microsoft-yahei"
      ]
    },
    "name": {
      "type": "string",
      "description": "Human-readable scheme name shown in pickers.",
      "examples": [
        "Aptos",
        "Tenorite",
        "Seaford",
        "Noto Sans",
        "Microsoft Yahei"
      ]
    },
    "major": {
      "type": "string",
      "description": "Heading (major) font family \u2014 mirrors the OOXML majorFont entry.",
      "examples": [
        "Aptos Display",
        "Calibri",
        "Microsoft YaHei"
      ]
    },
    "minor": {
      "type": "string",
      "description": "Body (minor) font family \u2014 mirrors the OOXML minorFont entry.",
      "examples": [
        "Aptos",
        "Calibri",
        "Microsoft YaHei"
      ]
    },
    "type": {
      "type": "string",
      "enum": [
        "sans-serif",
        "serif",
        "monospace"
      ],
      "description": "High-level typographic class of the scheme."
    },
    "app": {
      "type": "string",
      "enum": [
        "PowerPoint",
        "Google Slides"
      ],
      "description": "Target application this font pairing is intended for."
    },
    "languageFamily": {
      "type": "string",
      "enum": [
        "latin",
        "ea",
        "cs"
      ],
      "description": "OOXML font-language family this scheme is intended for: 'latin' for Latin-script content, 'ea' for East Asian scripts, 'cs' for Complex Scripts."
    },
    "languages": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Optional list of human-readable language names this scheme is curated for. Useful for picker UIs that group fonts by language coverage.",
      "examples": [
        [
          "Chinese (simplified)",
          "Chinese (traditional)",
          "Japanese",
          "Korean"
        ]
      ]
    },
    "textSample": {
      "type": "string",
      "description": "Short specimen string used by picker UIs to preview the scheme.",
      "examples": [
        "Smooth professional look",
        "\u8FD9\u662F\u7528\u5FAE\u8F6F\u96C5\u9ED1\u5B57\u4F53\u5199\u7684"
      ]
    },
    "summary": {
      "type": "string",
      "description": "One-sentence positioning of the font pairing.",
      "examples": [
        "PowerPoint-default sans-serif curated for general business decks.",
        "East-Asian sans-serif suitable for Chinese, Japanese, and Korean content."
      ]
    },
    "description": {
      "type": "string",
      "description": "Longer prose describing the font scheme and where it shines.",
      "examples": [
        "Aptos is the default Microsoft 365 sans-serif. The major (display) cut adds optical weight for headings, and the minor (text) cut keeps body copy readable at smaller sizes."
      ]
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Free-form labels for filtering and search.",
      "examples": [
        [
          "latin",
          "sans-serif",
          "default"
        ],
        [
          "east-asian",
          "system"
        ]
      ]
    },
    "preview": {
      "type": "object",
      "description": "Visual previews of the record, used by picker UIs and inline rendering. All sub-fields are optional; engines fall back gracefully when previews aren't available.",
      "properties": {
        "src": {
          "type": "string",
          "format": "uri",
          "description": "Main preview image (PNG/JPG). Used as the primary visual in picker UIs and previews of the record.",
          "examples": [
            "https://www.pptx.gallery/font-schemes/aptos.png"
          ]
        },
        "thumbnailSrc": {
          "type": "string",
          "format": "uri",
          "description": "Smaller thumbnail preview suited to dense grid views.",
          "examples": [
            "https://www.pptx.gallery/font-schemes/aptos.thumbnail.png"
          ]
        },
        "vectorSrc": {
          "type": "string",
          "format": "uri",
          "description": "SVG / vector preview for crisp scaling at any size.",
          "examples": [
            "https://www.pptx.gallery/font-schemes/aptos.svg"
          ]
        }
      }
    }
  }
};
var schemas = {
  presentation,
  audience,
  purpose,
  tone,
  theme,
  layout,
  chartType,
  narrative,
  socialPlatform,
  language,
  colorScheme,
  fontScheme
};
var schemaNames = [
  "presentation",
  "audience",
  "purpose",
  "tone",
  "theme",
  "layout",
  "chartType",
  "narrative",
  "socialPlatform",
  "language",
  "colorScheme",
  "fontScheme"
];
var schemaEntries = [
  { name: "presentation", file: "schemas/opf.schema.json", schema: presentation },
  { name: "audience", file: "schemas/audience.schema.json", schema: audience },
  { name: "purpose", file: "schemas/purpose.schema.json", schema: purpose },
  { name: "tone", file: "schemas/tone.schema.json", schema: tone },
  { name: "theme", file: "schemas/theme.schema.json", schema: theme },
  { name: "layout", file: "schemas/layout.schema.json", schema: layout },
  { name: "chartType", file: "schemas/chart-type.schema.json", schema: chartType },
  { name: "narrative", file: "schemas/narrative.schema.json", schema: narrative },
  { name: "socialPlatform", file: "schemas/social-platform.schema.json", schema: socialPlatform },
  { name: "language", file: "schemas/language.schema.json", schema: language },
  { name: "colorScheme", file: "schemas/color-scheme.schema.json", schema: colorScheme },
  { name: "fontScheme", file: "schemas/font-scheme.schema.json", schema: fontScheme }
];

export { audience, chartType, colorScheme, fontScheme, language, layout, narrative, presentation, purpose, schemaEntries, schemaNames, schemas, socialPlatform, theme, tone };
