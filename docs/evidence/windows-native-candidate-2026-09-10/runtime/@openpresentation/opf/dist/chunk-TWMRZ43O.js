// src/generated/catalogs.ts
var audiences = [
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "executives",
    "name": "Executives",
    "summary": "Senior leaders who need the recommendation up front, the evidence behind it, and the ask.",
    "description": "Executives are time-poor and decision-oriented. Lead with the recommendation, support it with three claims and one number per claim, and end with a clear ask. Avoid drilling into mechanisms unless invited; offer to follow up rather than including everything in the deck.",
    "seniority": "c-suite",
    "technicalFluency": "medium",
    "decisionPower": "decision-maker",
    "attentionBudgetMinutes": 30,
    "recommendedNarratives": [
      "scqa",
      "qbr",
      "strategic-narrative",
      "project-proposal"
    ],
    "recommendedTones": [
      "formal",
      "authoritative",
      "persuasive"
    ],
    "tags": [
      "leadership",
      "decision-making"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "board",
    "name": "Board of Directors",
    "summary": "Directors with fiduciary responsibility who balance oversight, advice, and approval.",
    "description": "The board is governance-first. They want a complete picture: financial health, key metrics, functional updates, risks, and forward-looking topics. Surface bad news honestly \u2014 under-disclosure erodes trust faster than the problems themselves. Bring specific asks that turn the meeting into a working session rather than a recital.",
    "seniority": "c-suite",
    "technicalFluency": "medium",
    "decisionPower": "decision-maker",
    "attentionBudgetMinutes": 90,
    "recommendedNarratives": [
      "board-meeting",
      "qbr",
      "scqa",
      "strategic-advisory"
    ],
    "recommendedTones": [
      "formal",
      "authoritative"
    ],
    "tags": [
      "governance",
      "oversight",
      "leadership"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "engineering-team",
    "name": "Engineering Team",
    "summary": "Practitioners building the system; they want depth, mechanism, and tradeoffs.",
    "description": "Engineers tune out generalities and tune in to specifics. Show benchmarks with conditions, architecture diagrams with constraints, and tradeoffs you actually considered. Internal jargon is fine \u2014 assume the room shares it. Leave room for questions; engineering audiences engage best when they can poke at the proposal.",
    "seniority": "ic",
    "technicalFluency": "high",
    "decisionPower": "advisory",
    "attentionBudgetMinutes": 45,
    "recommendedNarratives": [
      "status-update",
      "challenge-resolution",
      "innovation",
      "weekly-progress"
    ],
    "recommendedTones": [
      "technical",
      "casual",
      "conversational"
    ],
    "tags": [
      "internal",
      "engineering",
      "practitioner"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "investors",
    "name": "Investors",
    "summary": "Capital allocators evaluating fit, traction, and risk-adjusted return.",
    "description": "Investors read pattern-matching against their existing portfolio. They want the story (why this market, why now, why you), the proof (traction, retention, gross margin, growth rate), and the ask (raise size, use of funds, milestones). They will not assume \u2014 make the bull case explicit and acknowledge the bear case rather than hide it.",
    "seniority": "mixed",
    "technicalFluency": "medium",
    "decisionPower": "decision-maker",
    "attentionBudgetMinutes": 30,
    "recommendedNarratives": [
      "venture-pitch",
      "early-startup-pitch",
      "pitch-deck",
      "strategic-narrative"
    ],
    "recommendedTones": [
      "persuasive",
      "authoritative",
      "inspirational"
    ],
    "tags": [
      "external",
      "capital",
      "fundraising"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "customers",
    "name": "Customers",
    "summary": "Buyers and users \u2014 outcome-focused, allergic to jargon, sensitive to time.",
    "description": "Customer audiences want to know what changes for them. Lead with their problem in their language; show the solution as a path; demonstrate it with peers they recognize. Keep the technical depth in an appendix unless asked. Always close with the next concrete step (trial, pilot, intro).",
    "seniority": "mixed",
    "technicalFluency": "mixed",
    "decisionPower": "decision-maker",
    "attentionBudgetMinutes": 30,
    "recommendedNarratives": [
      "problem-solution",
      "persuasive-sales",
      "challenge-resolution",
      "company-intro"
    ],
    "recommendedTones": [
      "persuasive",
      "casual",
      "authoritative"
    ],
    "tags": [
      "external",
      "customer",
      "sales"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "sales-team",
    "name": "Sales Team",
    "summary": "Quota-carrying reps who want talk tracks, objection handling, and crisp proof.",
    "description": "Sales audiences need actionable assets, not strategy framing. Surface the talk tracks they'll repeat, the three objections they'll hear, and the data points that close. Keep slides scannable \u2014 much of this content is consumed asynchronously between calls.",
    "seniority": "mixed",
    "technicalFluency": "low",
    "decisionPower": "informational",
    "attentionBudgetMinutes": 30,
    "recommendedNarratives": [
      "marketing-strategy",
      "persuasive-sales",
      "weekly-progress",
      "status-update"
    ],
    "recommendedTones": [
      "casual",
      "persuasive",
      "conversational"
    ],
    "tags": [
      "internal",
      "go-to-market",
      "enablement"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "marketing-team",
    "name": "Marketing Team",
    "summary": "Brand and demand-gen practitioners aligning on positioning, messaging, and campaigns.",
    "description": "Marketing audiences want positioning, messaging hierarchy, and campaign-level metrics. Tie strategy to specific campaigns and channels. Show the funnel \u2014 leads, conversion, velocity \u2014 and explain how each campaign moves a stage of it.",
    "seniority": "mixed",
    "technicalFluency": "low",
    "decisionPower": "advisory",
    "attentionBudgetMinutes": 45,
    "recommendedNarratives": [
      "marketing-strategy",
      "product-launch",
      "qbr",
      "weekly-progress"
    ],
    "recommendedTones": [
      "casual",
      "persuasive",
      "authoritative"
    ],
    "tags": [
      "internal",
      "go-to-market",
      "brand"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "all-hands",
    "name": "All Hands",
    "summary": "The full company \u2014 mixed roles, mixed seniority, looking for context, signal, and inclusion.",
    "description": "An all-hands audience spans the whole company. Frame the period in terms anyone can grasp: what we did, what mattered, and what's next. Highlight people and teams; surface successes and challenges; close on a forward-looking note. Avoid lapsing into function-specific jargon.",
    "seniority": "mixed",
    "technicalFluency": "mixed",
    "decisionPower": "informational",
    "attentionBudgetMinutes": 60,
    "recommendedNarratives": [
      "company-intro",
      "weekly-progress",
      "qbr",
      "rags-to-riches"
    ],
    "recommendedTones": [
      "casual",
      "inspirational",
      "conversational"
    ],
    "tags": [
      "internal",
      "company-wide"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "candidates",
    "name": "Candidates",
    "summary": "Potential hires evaluating company, role, and people.",
    "description": "Candidates are weighing a major life decision and have many alternatives. Lead with mission and why-now, show the team they'll work with, and be honest about the stage. Avoid generic recruiting copy \u2014 specifics build trust faster than polish.",
    "seniority": "mixed",
    "technicalFluency": "mixed",
    "decisionPower": "decision-maker",
    "attentionBudgetMinutes": 45,
    "recommendedNarratives": [
      "company-intro",
      "golden-circle",
      "rags-to-riches",
      "venture-pitch"
    ],
    "recommendedTones": [
      "inspirational",
      "casual",
      "authoritative"
    ],
    "tags": [
      "external",
      "hiring",
      "recruiting"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-audience/v1",
    "id": "regulators",
    "name": "Regulators",
    "summary": "Government, agency, and policy reviewers evaluating compliance, risk, and impact.",
    "description": "Regulator audiences expect precision, completeness, and verifiable claims. Cite frameworks and standards explicitly; quantify risks with named mitigations; avoid promotional framing entirely. Document what you don't know alongside what you do.",
    "seniority": "mixed",
    "technicalFluency": "medium",
    "decisionPower": "decision-maker",
    "attentionBudgetMinutes": 60,
    "recommendedNarratives": [
      "scqa",
      "challenge-resolution",
      "strategic-advisory",
      "performance-improvement-plan"
    ],
    "recommendedTones": [
      "formal",
      "authoritative",
      "technical"
    ],
    "tags": [
      "external",
      "compliance",
      "policy"
    ]
  }
];
var purposes = [
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "inform",
    "name": "Inform",
    "summary": "Give the audience clear context, facts, or status without asking for a decision.",
    "description": "Use when the deck needs to make the audience aware of current state, background, or findings. Prioritize clarity, completeness, and accurate framing over persuasion.",
    "outcome": "The audience understands the situation and can repeat the important facts.",
    "successCriteria": [
      "Audience can summarize the key facts",
      "No immediate decision is required",
      "Follow-up questions are about implications, not basic context"
    ],
    "recommendedNarratives": [
      "status-update",
      "focus",
      "educate"
    ],
    "recommendedTones": [
      "formal",
      "conversational"
    ],
    "tags": [
      "awareness",
      "context",
      "status"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "decide",
    "name": "Drive a Decision",
    "summary": "Frame options, evidence, tradeoffs, and a recommendation so the audience can choose.",
    "description": "Use when the deck exists to get a yes/no, select among options, approve a recommendation, or resolve ambiguity. Lead with the decision needed and make the ask explicit.",
    "outcome": "The audience makes or authorizes a clear decision.",
    "successCriteria": [
      "Decision owner understands the options",
      "Recommendation and tradeoffs are explicit",
      "The final ask is concrete"
    ],
    "recommendedNarratives": [
      "scqa",
      "board-meeting",
      "project-proposal"
    ],
    "recommendedTones": [
      "formal",
      "authoritative",
      "persuasive"
    ],
    "tags": [
      "decision",
      "recommendation",
      "approval"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "align",
    "name": "Align",
    "summary": "Create shared understanding and commitment across people who need to move together.",
    "description": "Use when stakeholders need a common view of goals, constraints, priorities, or responsibilities. Emphasize shared language, explicit tradeoffs, and next steps.",
    "outcome": "Stakeholders leave with the same priorities and operating assumptions.",
    "successCriteria": [
      "Teams agree on priorities",
      "Open disagreements are surfaced",
      "Owners and next steps are clear"
    ],
    "recommendedNarratives": [
      "strategic-narrative",
      "transformation-arc",
      "business-review"
    ],
    "recommendedTones": [
      "conversational",
      "authoritative"
    ],
    "tags": [
      "alignment",
      "strategy",
      "coordination"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "persuade",
    "name": "Persuade",
    "summary": "Change belief or win support for a specific argument, idea, or recommendation.",
    "description": "Use when the audience may be skeptical or undecided. Build a crisp thesis, support it with evidence, address objections, and end with a clear action.",
    "outcome": "The audience accepts the argument or supports the recommendation.",
    "successCriteria": [
      "Main thesis is memorable",
      "Evidence supports the argument",
      "Likely objections are handled"
    ],
    "recommendedNarratives": [
      "problem-solution",
      "persuasive-sales",
      "golden-circle"
    ],
    "recommendedTones": [
      "persuasive",
      "authoritative"
    ],
    "tags": [
      "argument",
      "support",
      "belief-change"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "educate",
    "name": "Educate",
    "summary": "Teach a concept, process, product, or domain so the audience can use it correctly.",
    "description": "Use when the primary job is learning. Structure around concepts, examples, practice, and checks for understanding rather than persuasion or reporting.",
    "outcome": "The audience understands the material well enough to apply it.",
    "successCriteria": [
      "Definitions and examples are clear",
      "Audience can apply the concept",
      "Complexity builds progressively"
    ],
    "recommendedNarratives": [
      "educate",
      "focus",
      "company-intro"
    ],
    "recommendedTones": [
      "conversational",
      "technical"
    ],
    "tags": [
      "learning",
      "training",
      "enablement"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "report",
    "name": "Report",
    "summary": "Summarize performance, progress, or findings with enough context to interpret results.",
    "description": "Use for business reviews, project updates, research summaries, and recurring operating cadences. Prioritize the metric, the movement, the reason, and the implication.",
    "outcome": "The audience understands what happened, why it happened, and what it means.",
    "successCriteria": [
      "Key metrics are easy to scan",
      "Variance and drivers are explained",
      "Implications are explicit"
    ],
    "recommendedNarratives": [
      "qbr",
      "business-review",
      "status-update",
      "survey-analysis"
    ],
    "recommendedTones": [
      "formal",
      "technical"
    ],
    "tags": [
      "performance",
      "progress",
      "findings"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "pitch",
    "name": "Pitch",
    "summary": "Present an opportunity and ask for investment, approval, partnership, or sponsorship.",
    "description": "Use when the deck needs to create interest and move a high-stakes audience toward backing the opportunity. Lead with the opportunity, prove credibility, and make the ask concrete.",
    "outcome": "The audience agrees to invest, sponsor, approve, or continue the conversation.",
    "successCriteria": [
      "Opportunity is clear",
      "Evidence builds confidence",
      "Ask and next step are explicit"
    ],
    "recommendedNarratives": [
      "pitch-deck",
      "venture-pitch",
      "golden-circle"
    ],
    "recommendedTones": [
      "persuasive",
      "authoritative",
      "inspirational"
    ],
    "tags": [
      "fundraising",
      "opportunity",
      "ask"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "sell",
    "name": "Sell",
    "summary": "Move a buyer or evaluator toward purchase, adoption, renewal, or expansion.",
    "description": "Use for customer-facing decks where the goal is commercial movement. Focus on pain, value, proof, differentiation, and the next buying step.",
    "outcome": "The buyer advances to the next step in the commercial process.",
    "successCriteria": [
      "Customer pain is named clearly",
      "Value is tied to customer outcomes",
      "Next commercial step is clear"
    ],
    "recommendedNarratives": [
      "persuasive-sales",
      "problem-solution",
      "challenge-resolution"
    ],
    "recommendedTones": [
      "persuasive",
      "conversational"
    ],
    "tags": [
      "sales",
      "customer",
      "commercial"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-purpose/v1",
    "id": "plan",
    "name": "Plan",
    "summary": "Establish a roadmap, operating plan, or sequence of actions with owners and next steps.",
    "description": "Use when the deck should turn strategy into coordinated action. Make sequencing, ownership, dependencies, risks, and checkpoints visible.",
    "outcome": "The audience understands the plan and accepts the next actions.",
    "successCriteria": [
      "Milestones and owners are clear",
      "Dependencies and risks are visible",
      "Next steps can be executed"
    ],
    "recommendedNarratives": [
      "project-proposal",
      "capacity-planning",
      "strategic-advisory"
    ],
    "recommendedTones": [
      "authoritative",
      "technical"
    ],
    "tags": [
      "roadmap",
      "execution",
      "planning"
    ]
  }
];
var tones = [
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "formal",
    "name": "Formal",
    "summary": "Polished, restrained voice for board, investor, and regulator audiences.",
    "description": "Authoritative without being cold. Use third-person constructions, full sentences, and concrete numbers. Avoid hedges and humor that depend on shared in-jokes; rely on clarity and precision to land.",
    "voiceCues": [
      "Use third person and the corporate 'we' sparingly.",
      "Lead with the recommendation, then evidence.",
      "Quote concrete numbers; avoid round-tripping ranges.",
      "Prefer full sentences to bullet fragments on key claims."
    ],
    "avoid": [
      "Slang, idioms, or in-jokes.",
      "Hedging language ('maybe', 'sort of', 'I think').",
      "Marketing superlatives ('world-class', 'best-in-class').",
      "Excessive emoji or exclamation points."
    ],
    "samplePhrases": [
      "Q4 revenue grew 18% year over year, led by enterprise expansion.",
      "We recommend approving the Series B raise at $30M.",
      "Net retention was 124%; gross retention was 96%."
    ],
    "recommendedNarratives": [
      "board-meeting",
      "qbr",
      "scqa",
      "strategic-narrative"
    ],
    "tags": [
      "business",
      "executive",
      "formal"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "casual",
    "name": "Casual",
    "summary": "Warm, plain-spoken voice for internal updates and customer storytelling.",
    "description": "Friendly and direct. Use first- and second-person freely; favor short sentences and contractions. Numbers are still welcome \u2014 they just sit alongside human-scale framing rather than leading.",
    "voiceCues": [
      "Use first and second person.",
      "Use contractions ('we're', 'it's', 'don't').",
      "Favor short sentences and active voice.",
      "Frame metrics with a human-scale anchor when possible."
    ],
    "avoid": [
      "Stiff corporate jargon.",
      "Long compound sentences.",
      "Overuse of superlatives.",
      "Bureaucratic passive voice."
    ],
    "samplePhrases": [
      "We shipped the new dashboard last week, and customers are already moving over.",
      "Here's where we ended up on hiring this quarter.",
      "It's been a busy month \u2014 here's the recap."
    ],
    "recommendedNarratives": [
      "weekly-progress",
      "status-update",
      "company-intro",
      "focus"
    ],
    "tags": [
      "internal",
      "warm",
      "conversational"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "inspirational",
    "name": "Inspirational",
    "summary": "Aspirational, narrative-driven voice for keynotes, founders, and rallying cries.",
    "description": "Reach for shared belief and possibility, then ground it in something concrete. Use vivid imagery and rhythm; avoid collapsing into hype by always pairing aspiration with a real anchor.",
    "voiceCues": [
      "Open with belief; close with action.",
      "Use rhythm \u2014 paired phrases, repetition, deliberate beats.",
      "Pair every aspirational claim with a concrete proof point.",
      "Speak in present tense to make the future feel inevitable."
    ],
    "avoid": [
      "Empty hype without evidence.",
      "Stacked superlatives ('the very best, world-changing, revolutionary').",
      "Cynical or hedging language.",
      "Dense data tables \u2014 push numbers into supporting slides."
    ],
    "samplePhrases": [
      "We're building the runtime that makes agents feel instant.",
      "When latency disappears, what becomes possible?",
      "The next decade of software belongs to teams who treat speed as a feature."
    ],
    "recommendedNarratives": [
      "golden-circle",
      "conference-talk",
      "venture-pitch",
      "company-intro"
    ],
    "tags": [
      "motivational",
      "keynote",
      "founder"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "technical",
    "name": "Technical",
    "summary": "Precise, evidence-led voice for engineering, research, and product-detail audiences.",
    "description": "Lead with the question or claim, then walk through the mechanism and the numbers. Use exact terminology; assume the audience can handle and prefers it. Diagrams, tables, and benchmarks are first-class.",
    "voiceCues": [
      "State the claim, then the mechanism, then the evidence.",
      "Use exact terminology \u2014 don't soften technical terms for general readability.",
      "Quote benchmarks with conditions (cold/warm, p50/p95/p99, dataset, hardware).",
      "Prefer diagrams and tables over prose paragraphs for structural information."
    ],
    "avoid": [
      "Vague claims ('much faster', 'better', 'easier').",
      "Marketing framing without supporting data.",
      "Glossing over caveats and tradeoffs.",
      "Casual register that obscures precision."
    ],
    "samplePhrases": [
      "p95 inference latency is 38ms on a single A100, down from 312ms on the prior runtime.",
      "We replaced the streaming serializer with a batched protobuf path; throughput rose 4.2\xD7 under load.",
      "The result holds for context windows up to 32k tokens; beyond that, see appendix B."
    ],
    "recommendedNarratives": [
      "challenge-resolution",
      "innovation",
      "conference-talk",
      "status-update"
    ],
    "tags": [
      "technical",
      "engineering",
      "research"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "persuasive",
    "name": "Persuasive",
    "summary": "Argument-led voice for sales, fundraising, and recommendation-driven decks.",
    "description": "Frame every section as an argument that builds toward an ask. Surface objections, answer them, and pair claims with the strongest available proof. Read more like a memo than a report.",
    "voiceCues": [
      "Lead each section with the claim it's making.",
      "Surface the strongest counter-argument and address it.",
      "Pair every claim with proof \u2014 customer, benchmark, or analyst.",
      "End on a clear ask with named owner and date."
    ],
    "avoid": [
      "Buried leads.",
      "Symmetrical 'on one hand / on the other' framing without a verdict.",
      "Information for its own sake \u2014 every chart should advance the argument.",
      "Passive endings without a clear ask."
    ],
    "samplePhrases": [
      "Adopting our runtime cuts inference latency 8\xD7 while preserving accuracy.",
      "The most common objection \u2014 'we'll be locked in' \u2014 is addressed by our open OPF spec.",
      "We're asking for a $30M Series B to ship into the enterprise tier."
    ],
    "recommendedNarratives": [
      "pitch-deck",
      "venture-pitch",
      "early-startup-pitch",
      "persuasive-sales",
      "project-proposal"
    ],
    "tags": [
      "sales",
      "pitch",
      "argumentative"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "authoritative",
    "name": "Authoritative",
    "summary": "Expert, declarative voice for category-defining and analyst-style decks.",
    "description": "Adopt the perspective of someone who's seen the full landscape and is willing to call it. Use plain declaratives \u2014 strong claims with the receipts to back them. Step back from internal-only context and frame in terms the wider industry would recognize.",
    "voiceCues": [
      "Use declarative sentences; trust the reader to follow.",
      "Frame in industry-wide terms, not company-internal language.",
      "Cite outside sources \u2014 analysts, benchmarks, public peers.",
      "Take a position; avoid 'on the other hand' symmetry without a verdict."
    ],
    "avoid": [
      "Hedging ('we believe', 'in our view') unless deliberately contrasting.",
      "Internal jargon and unexplained acronyms.",
      "First-person plural overload \u2014 speak for the work, not the team.",
      "Tentative phrasing that softens strong claims."
    ],
    "samplePhrases": [
      "Agent latency is the bottleneck of the next AI cycle.",
      "Three categories will absorb 80% of enterprise budget; we're built for the second.",
      "The benchmarks are public; the gap holds across every comparable workload."
    ],
    "recommendedNarratives": [
      "strategic-narrative",
      "pitch-deck",
      "conference-talk",
      "marketing-strategy"
    ],
    "tags": [
      "industry",
      "category",
      "analyst"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-tone/v1",
    "id": "conversational",
    "name": "Conversational",
    "summary": "Direct, dialog-style voice for podcasts, fireside chats, and small-group reviews.",
    "description": "Sound like one half of a real conversation. Ask questions on the slide and answer them; keep paragraphs short; lean into examples over abstractions. Useful when the deck is meant to support a discussion rather than to lecture.",
    "voiceCues": [
      "Ask a question on the slide, then answer it on the next.",
      "Use second person \u2014 speak to the room, not at it.",
      "Lean on stories and concrete examples over abstract framing.",
      "Keep each idea to one short paragraph; let the dialog do the rest."
    ],
    "avoid": [
      "Lecture-style monologue across many bullets.",
      "Hedge-laden academic phrasing.",
      "Stuffing slides \u2014 leave room for the discussion.",
      "Inside-baseball references the room may not share."
    ],
    "samplePhrases": [
      "Why now? Two things changed in the last six months.",
      "Here's the part that surprised us \u2014 and what we did about it.",
      "If you take one thing from this section, take this."
    ],
    "recommendedNarratives": [
      "focus",
      "company-intro",
      "weekly-progress",
      "performance-review"
    ],
    "tags": [
      "dialog",
      "podcast",
      "discussion"
    ]
  }
];
var themes = [
  {
    "$schema": "https://openpresentation.org/schema/opf-theme/v1",
    "id": "bold",
    "name": "Bold",
    "background": {
      "type": "theme",
      "slot": "light1"
    },
    "colorScheme": "burnt-orange",
    "description": "A vibrant, high-energy theme with bold colors and a dynamic, attention-grabbing style. Great for presentations that need to stand out.",
    "fontScheme": "impact",
    "dimensions": "widescreen"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-theme/v1",
    "id": "classic",
    "name": "Classic",
    "background": {
      "type": "theme",
      "slot": "light1"
    },
    "colorScheme": "cool-horizon",
    "description": "A timeless, clean, and versatile theme with balanced color contrasts and classic typography. Ideal for professional, readable presentations.",
    "fontScheme": "tenorite",
    "dimensions": "widescreen"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-theme/v1",
    "id": "dark",
    "name": "Dark",
    "background": {
      "type": "theme",
      "slot": "dark1"
    },
    "colorScheme": "boost",
    "description": "A rich dark-mode theme with bold contrast and modern style. Great for moody, high-impact presentations.",
    "fontScheme": "seaford",
    "dimensions": "widescreen"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-theme/v1",
    "id": "minimal",
    "name": "Minimal",
    "background": {
      "type": "theme",
      "slot": "dark2"
    },
    "colorScheme": "cool-horizon",
    "description": "A clean, minimalistic theme with a focus on simplicity and readability. Ideal for professional, straightforward presentations.",
    "fontScheme": "aptos",
    "dimensions": "widescreen"
  }
];
var layouts = [
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "blank",
    "name": "Blank",
    "placeholders": []
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "chart-1x",
    "name": "Chart 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "chart"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "chart-2x",
    "name": "Chart 2x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "chart"
      },
      {
        "type": "text"
      },
      {
        "type": "chart"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 2
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "chart-3x",
    "name": "Chart 3x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "chart"
      },
      {
        "type": "text"
      },
      {
        "type": "chart"
      },
      {
        "type": "text"
      },
      {
        "type": "chart"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 3
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "code-1x",
    "name": "Code 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "code"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "image-1x",
    "name": "Image 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "picture"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "image-2x",
    "name": "Image 2x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "picture"
      },
      {
        "type": "text"
      },
      {
        "type": "picture"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 2
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "image-3x",
    "name": "Image 3x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "picture"
      },
      {
        "type": "text"
      },
      {
        "type": "picture"
      },
      {
        "type": "text"
      },
      {
        "type": "picture"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 3
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "image-bleed",
    "name": "Image Bleed",
    "placeholders": [
      {
        "type": "picture"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "list-1x",
    "name": "List 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "list"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "list-2x",
    "name": "List 2x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "list-3x",
    "name": "List 3x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "list-4x",
    "name": "List 4x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 2
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "list-5x",
    "name": "List 5x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 3
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "list-6x",
    "name": "List 6x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      },
      {
        "type": "list"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 3
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "media-1x",
    "name": "Media 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "media"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "number-1x",
    "name": "Number 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "number-2x",
    "name": "Number 2x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "number-3x",
    "name": "Number 3x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "number-4x",
    "name": "Number 4x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 2
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "number-5x",
    "name": "Number 5x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 3
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "number-6x",
    "name": "Number 6x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "grid",
      "columns": 3
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "table-1x",
    "name": "Table 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "table"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "text-1x",
    "name": "Text 1x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "text-2x",
    "name": "Text 2x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "text-3x",
    "name": "Text 3x",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      },
      {
        "type": "text"
      }
    ],
    "composition": {
      "mode": "row"
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "title",
    "name": "Title",
    "placeholders": [
      {
        "type": "title"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-layout/v1",
    "id": "title-subtitle",
    "name": "Title Subtitle",
    "placeholders": [
      {
        "type": "title"
      },
      {
        "type": "subtitle"
      }
    ]
  }
];
var chartTypes = [
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-bullet-bar",
    "name": "100PCT_BULLET_BAR",
    "label": "100% Bullet Bar",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "bar",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet bars combine threshold bands with a value marker."
      }
    },
    "categories": 8,
    "columns": [
      "ValueCategory",
      "Alpha"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 1,
    "seriesGroups": 2,
    "slideNumber": 57,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Alpha",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Actual %",
      "Target %"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          61,
          95
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-bullet-bar-2x",
    "name": "100PCT_BULLET_BAR_2X",
    "label": "100% Bullet Bar 2x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "bar",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet bars combine threshold bands with a value marker."
      }
    },
    "categories": 8,
    "columns": [
      "ValueCategory",
      "Alpha",
      "Beta"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 2,
    "seriesGroups": 2,
    "slideNumber": 58,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$I$3",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Alpha",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Beta",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Actual %",
      "Target %"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          75,
          97
        ],
        [
          "Metric 2",
          70,
          84
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-bullet-bar-3x",
    "name": "100PCT_BULLET_BAR_3X",
    "label": "100% Bullet Bar 3x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "bar",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet bars combine threshold bands with a value marker."
      }
    },
    "categories": 8,
    "columns": [
      "ValueCategory",
      "Alpha",
      "Beta",
      "Gamma"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 59,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$I$4",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Alpha",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Beta",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Gamma",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Actual %",
      "Target %"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          95,
          75
        ],
        [
          "Metric 2",
          95,
          88
        ],
        [
          "Metric 3",
          65,
          82
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-bullet-column",
    "name": "100PCT_BULLET_COLUMN",
    "label": "100% Bullet Column",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet columns combine threshold bands with a value marker."
      }
    },
    "categories": 8,
    "columns": [
      "ValueCategory",
      "This Year"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 1,
    "seriesGroups": 2,
    "slideNumber": 51,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "This Year",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Actual %",
      "Target %"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          60,
          96
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-bullet-column-2x",
    "name": "100PCT_BULLET_COLUMN_2X",
    "label": "100% Bullet Colum 2x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet columns combine threshold bands with a value marker."
      }
    },
    "categories": 8,
    "columns": [
      "ValueCategory",
      "Last Year",
      "This Year"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 2,
    "seriesGroups": 2,
    "slideNumber": 52,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$3",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Last Year",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "This Year",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Actual %",
      "Target %"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          94,
          89
        ],
        [
          "Metric 2",
          86,
          76
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-bullet-column-3x",
    "name": "100PCT_BULLET_COLUMN_3X",
    "label": "100% Bullet Column 3x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet columns combine threshold bands with a value marker."
      }
    },
    "categories": 8,
    "columns": [
      "ValueCategory",
      "Two Years Ago",
      "Last Year",
      "This Year"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 53,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$4",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Two Years Ago",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Last Year",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "This Year",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "Actual %",
      "Target %"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          72,
          91
        ],
        [
          "Metric 2",
          83,
          94
        ],
        [
          "Metric 3",
          91,
          95
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-progress-bar",
    "name": "100PCT_PROGRESS_BAR",
    "label": "100% Progress Bar",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Category",
      "Target",
      "Actual"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 27,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$5",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Target",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Actual",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Remainder",
        "role": "helper",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Progress",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      }
    ],
    "helperColumns": [
      "Remainder",
      "Progress"
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Target",
          93,
          90,
          92,
          89,
          97,
          84
        ],
        [
          "Actual",
          62,
          76,
          92,
          74,
          93,
          61
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-stacked-area-2x",
    "name": "100PCT_STACKED_AREA_2X",
    "label": "100% Stacked Area 2x",
    "mappings": {
      "openxml": {
        "element": "areaChart",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Area",
    "groupSort": 5,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 31,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          51588,
          68008,
          90301,
          76162,
          65933,
          81810,
          68446,
          30861,
          72216,
          68991,
          43972,
          42406
        ],
        [
          "Value 2",
          93579,
          46347,
          78327,
          73517,
          92149,
          41358,
          45992,
          67654,
          20155,
          47450,
          40735,
          45614
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-stacked-area-3x",
    "name": "100PCT_STACKED_AREA_3X",
    "label": "100% Stacked Area 3x",
    "mappings": {
      "openxml": {
        "element": "areaChart",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Area",
    "groupSort": 5,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 32,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          54020,
          51904,
          80798,
          20561,
          28136,
          29769,
          40311,
          60205,
          30028,
          38043,
          18418,
          64377
        ],
        [
          "Value 2",
          63424,
          53369,
          81121,
          71069,
          64496,
          18161,
          37110,
          65069,
          61049,
          86556,
          12560,
          85456
        ],
        [
          "Value 3",
          59857,
          72518,
          10772,
          56105,
          49139,
          61116,
          64921,
          80545,
          81582,
          89069,
          38906,
          73993
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-stacked-bar-2x",
    "name": "100PCT_STACKED_BAR_2X",
    "label": "100% Stacked Bar 2x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 25,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value 1",
          66959,
          55309,
          51114,
          67199,
          89457,
          77033
        ],
        [
          "Value 2",
          25157,
          60488,
          85574,
          34914,
          43386,
          15817
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-stacked-bar-3x",
    "name": "100PCT_STACKED_BAR_3X",
    "label": "100% Stacked Bar 3x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 26,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value 1",
          67154,
          10221,
          78146,
          80575,
          97900,
          35825
        ],
        [
          "Value 2",
          57739,
          66531,
          19171,
          97062,
          53279,
          91678
        ],
        [
          "Value 3",
          51145,
          96951,
          26334,
          49363,
          76469,
          50538
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-stacked-column-2x",
    "name": "100PCT_STACKED_COLUMN_2X",
    "label": "100% Stacked Column 2x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "col",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Column",
    "groupSort": 1,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 5,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value 1",
          20458,
          40512,
          23238,
          59823,
          46434,
          69429,
          93320,
          57819
        ],
        [
          "Value 2",
          31319,
          58520,
          56566,
          37460,
          97841,
          44993,
          99593,
          94939
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "100pct-stacked-column-3x",
    "name": "100PCT_STACKED_COLUMN_3X",
    "label": "100% Stacked Column 3x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "col",
        "grouping": "percentStacked",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Column",
    "groupSort": 1,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 6,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value 1",
          19358,
          89840,
          93227,
          32431,
          80010,
          42087,
          31417,
          70589
        ],
        [
          "Value 2",
          59735,
          45382,
          93886,
          83e3,
          38785,
          99733,
          52504,
          17331
        ],
        [
          "Value 3",
          40021,
          14207,
          51347,
          62581,
          45093,
          18675,
          37653,
          84341
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "area",
    "name": "AREA",
    "label": "Area",
    "mappings": {
      "openxml": {
        "element": "areaChart",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Area",
    "groupSort": 5,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 28,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value",
          90676,
          84593,
          49446,
          63225,
          81819,
          10053,
          49829,
          47606,
          37549,
          66346,
          86019,
          89516
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "australia",
    "name": "AUSTRALIA",
    "label": "Australia",
    "mappings": {
      "openxml": {
        "element": "mapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 8,
    "columns": [
      "State/Territory",
      "Value"
    ],
    "group": "Map",
    "groupSort": 12,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 70,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "State/Territory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "State/Territory",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value",
          83889,
          85952,
          68838,
          99277,
          83989,
          94278,
          93269,
          91857
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bar",
    "name": "BAR",
    "label": "Bar",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "clustered",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 21,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value",
          30257,
          41029,
          31299,
          33206,
          64040,
          13248
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "box-and-whisker",
    "name": "BOX_AND_WHISKER",
    "label": "Box & Whisker",
    "mappings": {
      "openxml": {
        "element": "boxWhiskerChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 22,
    "columns": [
      "Category",
      "Series1"
    ],
    "group": "Other",
    "groupSort": 13,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 71,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$W$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13",
        "Cat 14",
        "Cat 15",
        "Cat 16",
        "Cat 17",
        "Cat 18",
        "Cat 19",
        "Cat 20",
        "Cat 21",
        "Cat 22"
      ],
      "rows": [
        [
          "Series1",
          52363,
          92210,
          51436,
          29786,
          67640,
          18950,
          71462,
          67961,
          92756,
          49691,
          46002,
          87518,
          17362,
          56129,
          76497,
          19724,
          50685,
          70521,
          69233,
          14929,
          17456,
          58331
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "box-and-whisker-2x",
    "name": "BOX_AND_WHISKER_2X",
    "label": "Box & Whisker 2x",
    "mappings": {
      "openxml": {
        "element": "boxWhiskerChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 22,
    "columns": [
      "Category",
      "Series1",
      "Series2"
    ],
    "group": "Other",
    "groupSort": 13,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 72,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$W$3",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Series2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13",
        "Cat 14",
        "Cat 15",
        "Cat 16",
        "Cat 17",
        "Cat 18",
        "Cat 19",
        "Cat 20",
        "Cat 21",
        "Cat 22"
      ],
      "rows": [
        [
          "Series1",
          47627,
          20057,
          94497,
          21835,
          90610,
          87867,
          76462,
          60394,
          70648,
          86064,
          82655,
          15376,
          68947,
          84928,
          95437,
          34672,
          52143,
          89299,
          72341,
          75715,
          29773,
          18109
        ],
        [
          "Series2",
          69050,
          23566,
          55015,
          21053,
          76132,
          94689,
          32617,
          15130,
          42472,
          67377,
          67595,
          78690,
          78517,
          89928,
          30807,
          57696,
          58870,
          47079,
          60779,
          63578,
          54350,
          98984
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "box-and-whisker-3x",
    "name": "BOX_AND_WHISKER_3X",
    "label": "Box & Whisker 3x",
    "mappings": {
      "openxml": {
        "element": "boxWhiskerChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 22,
    "columns": [
      "Category",
      "Series1",
      "Series2",
      "Series3"
    ],
    "group": "Other",
    "groupSort": 13,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 73,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$W$4",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Series2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Series3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13",
        "Cat 14",
        "Cat 15",
        "Cat 16",
        "Cat 17",
        "Cat 18",
        "Cat 19",
        "Cat 20",
        "Cat 21",
        "Cat 22"
      ],
      "rows": [
        [
          "Series1",
          88366,
          16863,
          92691,
          94843,
          53863,
          18639,
          53213,
          22387,
          83133,
          98916,
          60667,
          47243,
          43029,
          96057,
          88997,
          29709,
          53694,
          20682,
          86380,
          96980,
          28537,
          55851
        ],
        [
          "Series2",
          50662,
          95990,
          96787,
          61374,
          26901,
          87993,
          21104,
          50577,
          83259,
          59372,
          94343,
          53054,
          26750,
          97833,
          99838,
          78995,
          22249,
          94675,
          97878,
          65496,
          76648,
          57425
        ],
        [
          "Series3",
          12389,
          57526,
          50483,
          33627,
          38074,
          54791,
          73736,
          35166,
          39693,
          28030,
          30308,
          20114,
          48770,
          23256,
          76543,
          80748,
          79013,
          14947,
          96760,
          54140,
          91006,
          27176
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bullet-bar",
    "name": "BULLET_BAR",
    "label": "Bullet Bar",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "bar",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet bars combine threshold bands with a value marker."
      }
    },
    "categories": 6,
    "columns": [
      "ValueCategory",
      "Alpha"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 1,
    "seriesGroups": 2,
    "slideNumber": 54,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$2",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Alpha",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          88,
          99
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bullet-bar-2x",
    "name": "BULLET_BAR_2X",
    "label": "Bullet Bar 2x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "bar",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet bars combine threshold bands with a value marker."
      }
    },
    "categories": 6,
    "columns": [
      "ValueCategory",
      "Alpha",
      "Beta"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 2,
    "seriesGroups": 2,
    "slideNumber": 55,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$3",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Alpha",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Beta",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          63,
          81
        ],
        [
          "Metric 2",
          77,
          92
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bullet-bar-3x",
    "name": "BULLET_BAR_3X",
    "label": "Bullet Bar 3x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "bar",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet bars combine threshold bands with a value marker."
      }
    },
    "categories": 6,
    "columns": [
      "ValueCategory",
      "Alpha",
      "Beta",
      "Gamma"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 56,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$4",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Alpha",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Beta",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Gamma",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          68,
          84
        ],
        [
          "Metric 2",
          88,
          97
        ],
        [
          "Metric 3",
          91,
          78
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bullet-column",
    "name": "BULLET_COLUMN",
    "label": "Bullet Column",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet columns combine threshold bands with a value marker."
      }
    },
    "categories": 6,
    "columns": [
      "ValueCategory",
      "This Year"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 1,
    "seriesGroups": 3,
    "slideNumber": 48,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$2",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "This Year",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          85,
          99
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bullet-column-2x",
    "name": "BULLET_COLUMN_2X",
    "label": "Bullet Column 2x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet columns combine threshold bands with a value marker."
      }
    },
    "categories": 6,
    "columns": [
      "ValueCategory",
      "Last Year",
      "This Year"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 2,
    "seriesGroups": 3,
    "slideNumber": 49,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$3",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Last Year",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "This Year",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          95,
          76
        ],
        [
          "Metric 2",
          89,
          77
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "bullet-column-3x",
    "name": "BULLET_COLUMN_3X",
    "label": "Bullet Column 3x",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "stacked",
            "composition": "single"
          },
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          }
        ],
        "notes": "Bullet columns combine threshold bands with a value marker."
      }
    },
    "categories": 6,
    "columns": [
      "ValueCategory",
      "Two Years Ago",
      "Last Year",
      "This Year"
    ],
    "group": "Bullet",
    "groupSort": 10,
    "series": 3,
    "seriesGroups": 3,
    "slideNumber": 50,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$4",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "ValueCategory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Two Years Ago",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Last Year",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "This Year",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "helperColumns": [
      "Excellent",
      "Good",
      "Fair",
      "Poor"
    ],
    "sampleData": {
      "headers": [
        "ValueCategory",
        "Actual",
        "Target"
      ],
      "rows": [
        [
          "Metric 1",
          80,
          83
        ],
        [
          "Metric 2",
          80,
          78
        ],
        [
          "Metric 3",
          85,
          91
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "canada",
    "name": "CANADA",
    "label": "Canada",
    "mappings": {
      "openxml": {
        "element": "mapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 13,
    "columns": [
      "Province/Territory",
      "Value"
    ],
    "group": "Map",
    "groupSort": 12,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 68,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$N$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Province/Territory",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Province/Territory",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13"
      ],
      "rows": [
        [
          "Value",
          56019,
          94599,
          29358,
          40968,
          23474,
          29194,
          43550,
          35856,
          32740,
          88957,
          30036,
          95918,
          19876
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "clustered-bar-2x",
    "name": "CLUSTERED_BAR_2X",
    "label": "Clustered Bar 2x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "clustered",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 22,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value 1",
          33509,
          53540,
          63964,
          97806,
          42527,
          44970
        ],
        [
          "Value 2",
          30866,
          24168,
          60140,
          15075,
          71694,
          39154
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "clustered-column",
    "name": "CLUSTERED_COLUMN",
    "label": "Clustered Column",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "col",
        "grouping": "clustered",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Column",
    "groupSort": 1,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 2,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value 1",
          98696,
          81482,
          21395,
          87397,
          65302,
          14165,
          13905,
          22280
        ],
        [
          "Value 2",
          38657,
          40495,
          76237,
          88907,
          13478,
          83563,
          36062,
          95181
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "column",
    "name": "COLUMN",
    "label": "Column",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "col",
        "grouping": "clustered",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Column",
    "groupSort": 1,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 1,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
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
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dot-plot",
    "name": "DOT_PLOT",
    "label": "Dot Plot",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single",
        "notes": "Dot plots render as scatter markers in Open XML."
      }
    },
    "categories": 8,
    "columns": [
      "2023"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 1,
    "seriesGroups": 2,
    "slideNumber": 34,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "2023",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Spacing 1",
        "role": "helper",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "helperColumns": [
      "Spacing 1"
    ],
    "sampleData": {
      "headers": [
        "Series",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8"
      ],
      "rows": [
        [
          "2020",
          691807,
          128418,
          188025,
          549433,
          242291,
          584125,
          290556,
          152727
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dot-plot-2x",
    "name": "DOT_PLOT_2X",
    "label": "Dot Plot 2x",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single",
        "notes": "Dot plots render as scatter markers in Open XML."
      }
    },
    "categories": 8,
    "columns": [
      "2023",
      "2024"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 2,
    "seriesGroups": 2,
    "slideNumber": 35,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$4",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "2023",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "2024",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Spacing 1",
        "role": "helper",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Spacing 2",
        "role": "helper",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "helperColumns": [
      "Spacing 1",
      "Spacing 2"
    ],
    "sampleData": {
      "headers": [
        "Series",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8"
      ],
      "rows": [
        [
          "2020",
          372793,
          497519,
          443254,
          321941,
          576786,
          442722,
          453894,
          497542
        ],
        [
          "2021",
          391773,
          542042,
          364525,
          185884,
          593152,
          120324,
          665621,
          154615
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dot-plot-3x",
    "name": "DOT_PLOT_3X",
    "label": "Dot Plot 3x",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single",
        "notes": "Dot plots render as scatter markers in Open XML."
      }
    },
    "categories": 8,
    "columns": [
      "2023",
      "2024",
      "2025"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 36,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$6",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "2023",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "2024",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "2025",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Spacing 1",
        "role": "helper",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Spacing 2",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Spacing 3",
        "role": "helper",
        "type": "number",
        "position": "row5_col0"
      }
    ],
    "helperColumns": [
      "Spacing 1",
      "Spacing 2",
      "Spacing 3"
    ],
    "sampleData": {
      "headers": [
        "Series",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8"
      ],
      "rows": [
        [
          "2020",
          466960,
          335113,
          171951,
          142213,
          132537,
          359295,
          309044,
          121369
        ],
        [
          "2021",
          259784,
          350132,
          232352,
          596564,
          219946,
          691364,
          328552,
          587623
        ],
        [
          "2022",
          368690,
          486814,
          275939,
          220096,
          271720,
          426147,
          213349,
          126925
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dot-plot-4x",
    "name": "DOT_PLOT_4X",
    "label": "Dot Plot 4x",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single",
        "notes": "Dot plots render as scatter markers in Open XML."
      }
    },
    "categories": 8,
    "columns": [
      "2023",
      "2024",
      "2025",
      "2026"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 4,
    "seriesGroups": 2,
    "slideNumber": 37,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$8",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "2023",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "2024",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "2025",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "2026",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Spacing 1",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Spacing 2",
        "role": "helper",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "Spacing 3",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "Spacing 4",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      }
    ],
    "helperColumns": [
      "Spacing 1",
      "Spacing 2",
      "Spacing 3",
      "Spacing 4"
    ],
    "sampleData": {
      "headers": [
        "Series",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8"
      ],
      "rows": [
        [
          "2020",
          427110,
          493537,
          515922,
          307963,
          179688,
          354646,
          206851,
          416232
        ],
        [
          "2021",
          226935,
          693423,
          143064,
          464069,
          658623,
          549186,
          488571,
          172306
        ],
        [
          "2022",
          630538,
          457806,
          113266,
          540463,
          614013,
          210665,
          554582,
          479781
        ],
        [
          "2023",
          582071,
          260422,
          556641,
          284692,
          647091,
          383201,
          664315,
          606983
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dot-plot-5x",
    "name": "DOT_PLOT_5X",
    "label": "Dot Plot 5x",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single",
        "notes": "Dot plots render as scatter markers in Open XML."
      }
    },
    "categories": 8,
    "columns": [
      "2023",
      "2024",
      "2025",
      "2026",
      "2027"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 5,
    "seriesGroups": 2,
    "slideNumber": 38,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$10",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "2023",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "2024",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "2025",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "2026",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "2027",
        "role": "series",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Spacing 1",
        "role": "helper",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "Spacing 2",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "Spacing 3",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      },
      {
        "name": "Spacing 4",
        "role": "helper",
        "type": "number",
        "position": "row8_col0"
      },
      {
        "name": "Spacing 5",
        "role": "helper",
        "type": "number",
        "position": "row9_col0"
      }
    ],
    "helperColumns": [
      "Spacing 1",
      "Spacing 2",
      "Spacing 3",
      "Spacing 4",
      "Spacing 5"
    ],
    "sampleData": {
      "headers": [
        "Series",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8"
      ],
      "rows": [
        [
          "2020",
          587455,
          556732,
          381433,
          437960,
          357420,
          190872,
          392477,
          572700
        ],
        [
          "2021",
          355709,
          587282,
          697530,
          497399,
          452737,
          130094,
          618317,
          440802
        ],
        [
          "2022",
          290672,
          611233,
          322423,
          472060,
          370902,
          456871,
          393243,
          389688
        ],
        [
          "2023",
          682789,
          110644,
          641722,
          300337,
          189771,
          353080,
          526170,
          612311
        ],
        [
          "2024",
          682144,
          351997,
          599219,
          614663,
          569945,
          118080,
          197573,
          408528
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dot-plot-6x",
    "name": "DOT_PLOT_6X",
    "label": "Dot Plot 6x",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single",
        "notes": "Dot plots render as scatter markers in Open XML."
      }
    },
    "categories": 8,
    "columns": [
      "2023",
      "2024",
      "2025",
      "2026",
      "2027",
      "2028"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 6,
    "seriesGroups": 2,
    "slideNumber": 39,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$12",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "2023",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "2024",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "2025",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "2026",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "2027",
        "role": "series",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "2028",
        "role": "series",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "Spacing 1",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "Spacing 2",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      },
      {
        "name": "Spacing 3",
        "role": "helper",
        "type": "number",
        "position": "row8_col0"
      },
      {
        "name": "Spacing 4",
        "role": "helper",
        "type": "number",
        "position": "row9_col0"
      },
      {
        "name": "Spacing 5",
        "role": "helper",
        "type": "number",
        "position": "row10_col0"
      },
      {
        "name": "Spacing 6",
        "role": "helper",
        "type": "number",
        "position": "row11_col0"
      }
    ],
    "helperColumns": [
      "Spacing 1",
      "Spacing 2",
      "Spacing 3",
      "Spacing 4",
      "Spacing 5",
      "Spacing 6"
    ],
    "sampleData": {
      "headers": [
        "Series",
        "Item 1",
        "Item 2",
        "Item 3",
        "Item 4",
        "Item 5",
        "Item 6",
        "Item 7",
        "Item 8"
      ],
      "rows": [
        [
          "2020",
          332360,
          524045,
          355123,
          421080,
          486945,
          596249,
          680358,
          656711
        ],
        [
          "2021",
          460455,
          546173,
          677124,
          446859,
          468900,
          575786,
          384076,
          421517
        ],
        [
          "2022",
          363615,
          341736,
          226516,
          301939,
          430876,
          225362,
          661894,
          294143
        ],
        [
          "2023",
          300845,
          326895,
          607719,
          389930,
          650121,
          396745,
          205409,
          303547
        ],
        [
          "2024",
          410636,
          338533,
          478411,
          288158,
          416950,
          114835,
          660081,
          232731
        ],
        [
          "2025",
          387636,
          147726,
          157174,
          680238,
          406327,
          232413,
          614723,
          207570
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "doughnut",
    "name": "DOUGHNUT",
    "label": "Doughnut",
    "mappings": {
      "openxml": {
        "element": "doughnutChart",
        "composition": "single"
      }
    },
    "categories": 2,
    "columns": [
      "Segment",
      "Value 1"
    ],
    "group": "Pie",
    "groupSort": 3,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 20,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$C$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Segment",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Segment",
        "Q1 2024",
        "Q2 2024"
      ],
      "rows": [
        [
          "Value 1",
          63264,
          91351
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "dumbbell",
    "name": "DUMBBELL",
    "label": "Dumbbell",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "scatterChart",
            "scatterStyle": "marker",
            "composition": "single"
          },
          {
            "element": "lineChart",
            "composition": "single"
          }
        ],
        "notes": "Dumbbell charts combine point markers with connector lines."
      }
    },
    "categories": 6,
    "columns": [
      "Category",
      "Value 1",
      "Value 2",
      "Y-axis",
      "Error bar length 1",
      "Error bar length 2"
    ],
    "group": "Other",
    "groupSort": 13,
    "series": 5,
    "seriesGroups": 2,
    "slideNumber": 76,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$G$6",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "Category",
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
      },
      {
        "name": "Y-axis",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Error bar length 1",
        "role": "series",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Error bar length 2",
        "role": "series",
        "type": "number",
        "position": "row5_col0"
      }
    ],
    "helperColumns": [
      "Start",
      "End",
      "Connector Low",
      "Connector High"
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value 1",
          59111,
          70015,
          48673,
          79308,
          79056,
          81367
        ],
        [
          "Value 2",
          59420,
          45335,
          64996,
          45674,
          50281,
          82993
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "filled-radar",
    "name": "FILLED_RADAR",
    "label": "Filled Radar",
    "mappings": {
      "openxml": {
        "element": "radarChart",
        "radarStyle": "filled",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Radar",
    "groupSort": 7,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 42,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value",
          85631,
          92502,
          99974,
          17026,
          29887,
          29555,
          83772,
          49824
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "funnel",
    "name": "FUNNEL",
    "label": "Funnel",
    "mappings": {
      "openxml": {
        "element": "funnelChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 5,
    "columns": [
      "Category",
      "Series1"
    ],
    "group": "Other",
    "groupSort": 13,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 75,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$F$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025"
      ],
      "rows": [
        [
          "Series1",
          15726,
          63852,
          57749,
          98652,
          41133
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "histogram",
    "name": "HISTOGRAM",
    "label": "Histogram",
    "mappings": {
      "openxml": {
        "element": "histogramChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 49,
    "columns": [
      "Series1"
    ],
    "group": "Histogram",
    "groupSort": 9,
    "series": 0,
    "seriesGroups": 1,
    "slideNumber": 46,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$AX$1",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series1",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13",
        "Cat 14",
        "Cat 15",
        "Cat 16",
        "Cat 17",
        "Cat 18",
        "Cat 19",
        "Cat 20",
        "Cat 21",
        "Cat 22",
        "Cat 23",
        "Cat 24",
        "Cat 25",
        "Cat 26",
        "Cat 27",
        "Cat 28",
        "Cat 29",
        "Cat 30",
        "Cat 31",
        "Cat 32",
        "Cat 33",
        "Cat 34",
        "Cat 35",
        "Cat 36",
        "Cat 37",
        "Cat 38",
        "Cat 39",
        "Cat 40",
        "Cat 41",
        "Cat 42",
        "Cat 43",
        "Cat 44",
        "Cat 45",
        "Cat 46",
        "Cat 47",
        "Cat 48",
        "Cat 49"
      ],
      "rows": [
        [
          "Value",
          23006,
          37235,
          91987,
          37659,
          44687,
          96563,
          20641,
          30585,
          41439,
          32782,
          82350,
          19838,
          30517,
          10350,
          63545,
          69048,
          87832,
          71592,
          48175,
          14278,
          40340,
          47762,
          47056,
          69510,
          19329,
          40595,
          44675,
          91927,
          87304,
          96662,
          35928,
          65723,
          25043,
          81376,
          39466,
          94886,
          29528,
          44816,
          28643,
          19359,
          17816,
          31747,
          50319,
          87993,
          84607,
          47828,
          67560,
          26299,
          71433
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line",
    "name": "LINE",
    "label": "Line",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 9,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value",
          74042,
          12552,
          24662,
          57576,
          50306,
          41385,
          17592,
          41571,
          84364,
          20322,
          21226,
          73699
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-2x",
    "name": "LINE_2X",
    "label": "Line 2x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 11,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          37760,
          80686,
          36365,
          50857,
          62296,
          98039,
          95180,
          58944,
          67422,
          77839,
          69177,
          25860
        ],
        [
          "Value 2",
          42493,
          39451,
          18392,
          54313,
          12757,
          87110,
          82603,
          40161,
          87128,
          38864,
          10942,
          19305
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-3x",
    "name": "LINE_3X",
    "label": "Line 3x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 15,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          69638,
          47388,
          65444,
          82845,
          96752,
          73788,
          30289,
          34890,
          48890,
          38534,
          17665,
          85914
        ],
        [
          "Value 2",
          81066,
          17989,
          51104,
          17492,
          16572,
          86569,
          72493,
          75909,
          79615,
          30635,
          17455,
          76562
        ],
        [
          "Value 3",
          20500,
          34356,
          18981,
          87992,
          18907,
          98501,
          40828,
          62923,
          25713,
          84668,
          42271,
          85880
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-with-high-low",
    "name": "LINE_WITH_HIGH_LOW",
    "label": "Line with High/Low",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "lineChart",
            "marker": false,
            "composition": "single"
          },
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "clustered",
            "composition": "single"
          }
        ],
        "notes": "High/low variants combine the main line with auxiliary range series."
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value",
      "High",
      "Low"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 7,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$5",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "High",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Low",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Band",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      }
    ],
    "helperColumns": [
      "Band"
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value",
          76,
          65,
          40,
          33,
          61,
          51,
          45,
          76,
          78,
          61,
          49,
          29
        ],
        [
          "High",
          89,
          74,
          52,
          46,
          79,
          68,
          61,
          88,
          87,
          81,
          56,
          35
        ],
        [
          "Low",
          70,
          58,
          25,
          26,
          46,
          40,
          31,
          70,
          67,
          50,
          35,
          17
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-with-high-low-and-markers",
    "name": "LINE_WITH_HIGH_LOW_AND_MARKERS",
    "label": "Line with High/Low and Markers",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "lineChart",
            "marker": true,
            "composition": "single"
          },
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "clustered",
            "composition": "single"
          }
        ],
        "notes": "High/low variants combine the main line with auxiliary range series."
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value",
      "High",
      "Low"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 8,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$5",
    "complexity": "calculated",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "High",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Low",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Band",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      }
    ],
    "helperColumns": [
      "Band"
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value",
          53,
          36,
          55,
          75,
          80,
          20,
          63,
          66,
          27,
          63,
          76,
          54
        ],
        [
          "High",
          66,
          51,
          63,
          89,
          98,
          30,
          82,
          71,
          40,
          73,
          84,
          68
        ],
        [
          "Low",
          38,
          23,
          41,
          67,
          73,
          10,
          56,
          53,
          14,
          58,
          62,
          44
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-with-markers",
    "name": "LINE_WITH_MARKERS",
    "label": "Line with Markers",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "marker": true,
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 10,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value",
          19071,
          79822,
          26483,
          26828,
          96474,
          72296,
          82063,
          31643,
          44741,
          79163,
          89507,
          65461
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-with-markers-2x",
    "name": "LINE_WITH_MARKERS_2X",
    "label": "Line with Markers 2x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "marker": true,
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 12,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          92719,
          17716,
          40007,
          18834,
          14117,
          53309,
          19287,
          77391,
          41195,
          46500,
          97684,
          73624
        ],
        [
          "Value 2",
          38080,
          80678,
          27342,
          84847,
          85525,
          71953,
          41850,
          71993,
          63354,
          34957,
          22363,
          22704
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "line-with-markers-3x",
    "name": "LINE_WITH_MARKERS_3X",
    "label": "Line with Markers 3x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "marker": true,
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 16,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          87924,
          15209,
          91183,
          20745,
          64948,
          96163,
          86503,
          84085,
          78522,
          51467,
          44179,
          36772
        ],
        [
          "Value 2",
          97782,
          51180,
          41285,
          44814,
          61876,
          27154,
          98039,
          94607,
          49321,
          69929,
          51441,
          19508
        ],
        [
          "Value 3",
          11220,
          70068,
          91416,
          83792,
          23104,
          19602,
          80468,
          37938,
          76307,
          44760,
          27361,
          55745
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "pareto",
    "name": "PARETO",
    "label": "Pareto",
    "mappings": {
      "openxml": {
        "composition": "mixed",
        "series": [
          {
            "element": "barChart",
            "barDir": "col",
            "grouping": "clustered",
            "composition": "single"
          },
          {
            "element": "lineChart",
            "composition": "single"
          }
        ],
        "notes": "Pareto charts combine sorted columns with a cumulative-percentage line."
      }
    },
    "categories": 49,
    "columns": [
      "Category",
      "Series1"
    ],
    "group": "Histogram",
    "groupSort": 9,
    "series": 1,
    "seriesGroups": 2,
    "slideNumber": 47,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$AX$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13",
        "Cat 14",
        "Cat 15",
        "Cat 16",
        "Cat 17",
        "Cat 18",
        "Cat 19",
        "Cat 20",
        "Cat 21",
        "Cat 22",
        "Cat 23",
        "Cat 24",
        "Cat 25",
        "Cat 26",
        "Cat 27",
        "Cat 28",
        "Cat 29",
        "Cat 30",
        "Cat 31",
        "Cat 32",
        "Cat 33",
        "Cat 34",
        "Cat 35",
        "Cat 36",
        "Cat 37",
        "Cat 38",
        "Cat 39",
        "Cat 40",
        "Cat 41",
        "Cat 42",
        "Cat 43",
        "Cat 44",
        "Cat 45",
        "Cat 46",
        "Cat 47",
        "Cat 48",
        "Cat 49"
      ],
      "rows": [
        [
          "Series1",
          49857,
          62757,
          45683,
          75597,
          80776,
          74722,
          67377,
          20543,
          88385,
          15224,
          66626,
          52247,
          89129,
          42816,
          13390,
          21970,
          40005,
          98381,
          85392,
          86955,
          12719,
          98117,
          45325,
          85529,
          15273,
          32962,
          71669,
          78021,
          95394,
          67963,
          46458,
          33788,
          86720,
          67132,
          93202,
          74451,
          21959,
          71605,
          55607,
          63523,
          53687,
          52081,
          97835,
          23710,
          31079,
          53228,
          63955,
          74942,
          47777
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "pie",
    "name": "PIE",
    "label": "Pie",
    "mappings": {
      "openxml": {
        "element": "pieChart",
        "composition": "single"
      }
    },
    "categories": 2,
    "columns": [
      "Series 1",
      "Value 1"
    ],
    "group": "Pie",
    "groupSort": 3,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 19,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$C$2",
    "complexity": "simple",
    "dataColumns": [
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
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024"
      ],
      "rows": [
        [
          "Value 1",
          56357,
          83385
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "radar",
    "name": "RADAR",
    "label": "Radar",
    "mappings": {
      "openxml": {
        "element": "radarChart",
        "radarStyle": "standard",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Radar",
    "groupSort": 7,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 40,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value",
          11607,
          85243,
          47268,
          71524,
          72746,
          67733,
          54657,
          34164
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "radar-with-markers",
    "name": "RADAR_WITH_MARKERS",
    "label": "Radar with Markers",
    "mappings": {
      "openxml": {
        "element": "radarChart",
        "radarStyle": "marker",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value"
    ],
    "group": "Radar",
    "groupSort": 7,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 41,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Series 1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value",
          16734,
          43092,
          72616,
          24953,
          18564,
          62521,
          74454,
          19710
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "scatter",
    "name": "SCATTER",
    "label": "Scatter",
    "mappings": {
      "openxml": {
        "element": "scatterChart",
        "scatterStyle": "marker",
        "composition": "single"
      }
    },
    "categories": 9,
    "columns": [
      "Category",
      "X-Values",
      "Y-Values"
    ],
    "group": "XY (Scatter)",
    "groupSort": 6,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 33,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "X-Values",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Y-Values",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026"
      ],
      "rows": [
        [
          "X-Values",
          38760,
          45774,
          67125,
          73654,
          13804,
          60968,
          54057,
          97670,
          99016
        ],
        [
          "Y-Values",
          62994,
          31632,
          71261,
          26728,
          91560,
          80008,
          13534,
          61645,
          87580
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "sparkline",
    "name": "SPARKLINE",
    "label": "Sparkline",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single",
        "notes": "Presentation sparklines render as compact line charts."
      }
    },
    "categories": 12,
    "columns": [
      "Period",
      "Category 1"
    ],
    "group": "Sparkline",
    "groupSort": 11,
    "series": 1,
    "seriesGroups": 2,
    "slideNumber": 60,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$M$5",
    "complexity": "normalized",
    "dataColumns": [
      {
        "name": "Period",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Category 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "y",
        "role": "helper",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "y-Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      }
    ],
    "helperColumns": [
      "y",
      "Normalized 1",
      "y-Normalized 1"
    ],
    "sampleData": {
      "headers": [
        "Period",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "rows": [
        [
          "Category 1",
          234782949,
          140128302,
          190588397,
          199789165,
          263795306,
          211391462,
          304598959,
          249294712,
          275548145,
          147018690,
          238203096,
          265921274
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "sparkline-2x",
    "name": "SPARKLINE_2X",
    "label": "Sparkline 2x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single",
        "notes": "Presentation sparklines render as compact line charts."
      }
    },
    "categories": 12,
    "columns": [
      "Period",
      "Category 1",
      "Category 2"
    ],
    "group": "Sparkline",
    "groupSort": 11,
    "series": 2,
    "seriesGroups": 2,
    "slideNumber": 61,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$M$8",
    "complexity": "normalized",
    "dataColumns": [
      {
        "name": "Period",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Category 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Category 2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "y",
        "role": "helper",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "y-Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "y-Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      }
    ],
    "helperColumns": [
      "y",
      "Normalized 1",
      "y-Normalized 1",
      "Normalized 2",
      "y-Normalized 2"
    ],
    "sampleData": {
      "headers": [
        "Period",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "rows": [
        [
          "Category 1",
          127301224,
          160244644,
          230927220,
          209331614,
          235620392,
          198005536,
          271681313,
          253350193,
          183354651,
          223625868,
          280697637,
          283835394
        ],
        [
          "Category 2",
          347783209,
          350482613,
          294886422,
          277234281,
          390601900,
          364494634,
          380304637,
          389986295,
          263586140,
          326645109,
          336897908,
          406511445
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "sparkline-3x",
    "name": "SPARKLINE_3X",
    "label": "Sparkline 3x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single",
        "notes": "Presentation sparklines render as compact line charts."
      }
    },
    "categories": 12,
    "columns": [
      "Period",
      "Category 1",
      "Category 2",
      "Category 3"
    ],
    "group": "Sparkline",
    "groupSort": 11,
    "series": 3,
    "seriesGroups": 2,
    "slideNumber": 62,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$M$11",
    "complexity": "normalized",
    "dataColumns": [
      {
        "name": "Period",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Category 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Category 2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Category 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "y",
        "role": "helper",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      },
      {
        "name": "y-Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row8_col0"
      },
      {
        "name": "y-Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row9_col0"
      },
      {
        "name": "y-Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row10_col0"
      }
    ],
    "helperColumns": [
      "y",
      "Normalized 1",
      "y-Normalized 1",
      "Normalized 2",
      "y-Normalized 2",
      "Normalized 3",
      "y-Normalized 3"
    ],
    "sampleData": {
      "headers": [
        "Period",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "rows": [
        [
          "Category 1",
          338462295,
          276932956,
          400666289,
          347928219,
          415971322,
          310932479,
          341099445,
          395630768,
          338015417,
          349303356,
          372387534,
          399840797
        ],
        [
          "Category 2",
          218545093,
          280934686,
          256377435,
          282303827,
          229662184,
          329557775,
          242959879,
          233028457,
          274021564,
          257568424,
          244736923,
          325689941
        ],
        [
          "Category 3",
          309718062,
          186010334,
          271920884,
          366910365,
          230612761,
          313191655,
          320164466,
          376638873,
          356200696,
          380823365,
          396357729,
          334149486
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "sparkline-4x",
    "name": "SPARKLINE_4X",
    "label": "Sparkline 4x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single",
        "notes": "Presentation sparklines render as compact line charts."
      }
    },
    "categories": 12,
    "columns": [
      "Period",
      "Category 1",
      "Category 2",
      "Category 3",
      "Category 4"
    ],
    "group": "Sparkline",
    "groupSort": 11,
    "series": 4,
    "seriesGroups": 2,
    "slideNumber": 63,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$M$14",
    "complexity": "normalized",
    "dataColumns": [
      {
        "name": "Period",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Category 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Category 2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Category 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Category 4",
        "role": "series",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "y",
        "role": "helper",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      },
      {
        "name": "Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row8_col0"
      },
      {
        "name": "Normalized 4",
        "role": "helper",
        "type": "number",
        "position": "row9_col0"
      },
      {
        "name": "y-Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row10_col0"
      },
      {
        "name": "y-Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row11_col0"
      },
      {
        "name": "y-Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row12_col0"
      },
      {
        "name": "y-Normalized 4",
        "role": "helper",
        "type": "number",
        "position": "row13_col0"
      }
    ],
    "helperColumns": [
      "y",
      "Normalized 1",
      "y-Normalized 1",
      "Normalized 2",
      "y-Normalized 2",
      "Normalized 3",
      "y-Normalized 3",
      "Normalized 4",
      "y-Normalized 4"
    ],
    "sampleData": {
      "headers": [
        "Period",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "rows": [
        [
          "Category 1",
          351100762,
          352741011,
          379496599,
          387966832,
          282312384,
          311282670,
          452151921,
          379790805,
          433333748,
          384493624,
          422399875,
          417323155
        ],
        [
          "Category 2",
          112746904,
          221229196,
          183077367,
          149559096,
          179550365,
          213793767,
          147945453,
          227710269,
          229965985,
          174297265,
          161163531,
          183746340
        ],
        [
          "Category 3",
          237548014,
          134668693,
          198704600,
          207612874,
          201403806,
          147410128,
          125604425,
          201890459,
          198475165,
          249611663,
          269899922,
          220220298
        ],
        [
          "Category 4",
          151483519,
          143799732,
          124809837,
          255107244,
          238648426,
          290700676,
          206450687,
          161961806,
          284636227,
          166280805,
          280244757,
          229378769
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "sparkline-5x",
    "name": "SPARKLINE_5X",
    "label": "Sparkline 5x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single",
        "notes": "Presentation sparklines render as compact line charts."
      }
    },
    "categories": 12,
    "columns": [
      "Period",
      "Category 1",
      "Category 2",
      "Category 3",
      "Category 4",
      "Category 5"
    ],
    "group": "Sparkline",
    "groupSort": 11,
    "series": 5,
    "seriesGroups": 2,
    "slideNumber": 64,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$M$17",
    "complexity": "normalized",
    "dataColumns": [
      {
        "name": "Period",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Category 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Category 2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Category 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Category 4",
        "role": "series",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Category 5",
        "role": "series",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "y",
        "role": "helper",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      },
      {
        "name": "Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row8_col0"
      },
      {
        "name": "Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row9_col0"
      },
      {
        "name": "Normalized 4",
        "role": "helper",
        "type": "number",
        "position": "row10_col0"
      },
      {
        "name": "Normalized 5",
        "role": "helper",
        "type": "number",
        "position": "row11_col0"
      },
      {
        "name": "y-Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row12_col0"
      },
      {
        "name": "y-Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row13_col0"
      },
      {
        "name": "y-Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row14_col0"
      },
      {
        "name": "y-Normalized 4",
        "role": "helper",
        "type": "number",
        "position": "row15_col0"
      },
      {
        "name": "y-Normalized 5",
        "role": "helper",
        "type": "number",
        "position": "row16_col0"
      }
    ],
    "helperColumns": [
      "y",
      "Normalized 1",
      "y-Normalized 1",
      "Normalized 2",
      "y-Normalized 2",
      "Normalized 3",
      "y-Normalized 3",
      "Normalized 4",
      "y-Normalized 4",
      "Normalized 5",
      "y-Normalized 5"
    ],
    "sampleData": {
      "headers": [
        "Period",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "rows": [
        [
          "Category 1",
          394192109,
          298791835,
          291735757,
          387547136,
          285549617,
          402554736,
          416691818,
          370896114,
          338524862,
          436475508,
          450689044,
          445346510
        ],
        [
          "Category 2",
          184694692,
          187026655,
          243832637,
          215693071,
          282879921,
          223502304,
          262672508,
          340961425,
          244063499,
          269927808,
          172394131,
          209079951
        ],
        [
          "Category 3",
          407310440,
          361244398,
          363019404,
          348933300,
          412854772,
          455414485,
          396335652,
          361436061,
          448877666,
          381689431,
          463288538,
          442714573
        ],
        [
          "Category 4",
          397995978,
          514303755,
          385564250,
          542703984,
          525924909,
          434505855,
          538801568,
          531604872,
          472201924,
          575190383,
          462741434,
          482489022
        ],
        [
          "Category 5",
          191572637,
          286844139,
          254728898,
          315419922,
          294583213,
          302197618,
          204085411,
          345307584,
          283404222,
          355759261,
          340962092,
          354360356
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "sparkline-6x",
    "name": "SPARKLINE_6X",
    "label": "Sparkline 6x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "composition": "single",
        "notes": "Presentation sparklines render as compact line charts."
      }
    },
    "categories": 12,
    "columns": [
      "Period",
      "Category 1",
      "Category 2",
      "Category 3",
      "Category 4",
      "Category 5",
      "Category 6"
    ],
    "group": "Sparkline",
    "groupSort": 11,
    "series": 6,
    "seriesGroups": 2,
    "slideNumber": 65,
    "useSecondaryCategories": true,
    "workbookRange": "Sheet1!$A$1:$M$20",
    "complexity": "normalized",
    "dataColumns": [
      {
        "name": "Period",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Category 1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Category 2",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Category 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      },
      {
        "name": "Category 4",
        "role": "series",
        "type": "number",
        "position": "row4_col0"
      },
      {
        "name": "Category 5",
        "role": "series",
        "type": "number",
        "position": "row5_col0"
      },
      {
        "name": "Category 6",
        "role": "series",
        "type": "number",
        "position": "row6_col0"
      },
      {
        "name": "y",
        "role": "helper",
        "type": "number",
        "position": "row7_col0"
      },
      {
        "name": "Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row8_col0"
      },
      {
        "name": "Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row9_col0"
      },
      {
        "name": "Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row10_col0"
      },
      {
        "name": "Normalized 4",
        "role": "helper",
        "type": "number",
        "position": "row11_col0"
      },
      {
        "name": "Normalized 5",
        "role": "helper",
        "type": "number",
        "position": "row12_col0"
      },
      {
        "name": "Normalized 6",
        "role": "helper",
        "type": "number",
        "position": "row13_col0"
      },
      {
        "name": "y-Normalized 1",
        "role": "helper",
        "type": "number",
        "position": "row14_col0"
      },
      {
        "name": "y-Normalized 2",
        "role": "helper",
        "type": "number",
        "position": "row15_col0"
      },
      {
        "name": "y-Normalized 3",
        "role": "helper",
        "type": "number",
        "position": "row16_col0"
      },
      {
        "name": "y-Normalized 4",
        "role": "helper",
        "type": "number",
        "position": "row17_col0"
      },
      {
        "name": "y-Normalized 5",
        "role": "helper",
        "type": "number",
        "position": "row18_col0"
      },
      {
        "name": "y-Normalized 6",
        "role": "helper",
        "type": "number",
        "position": "row19_col0"
      }
    ],
    "helperColumns": [
      "y",
      "Normalized 1",
      "y-Normalized 1",
      "Normalized 2",
      "y-Normalized 2",
      "Normalized 3",
      "y-Normalized 3",
      "Normalized 4",
      "y-Normalized 4",
      "Normalized 5",
      "y-Normalized 5",
      "Normalized 6",
      "y-Normalized 6"
    ],
    "sampleData": {
      "headers": [
        "Period",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
      ],
      "rows": [
        [
          "Category 1",
          298857152,
          388866097,
          343702065,
          321373221,
          433801619,
          315484508,
          301751511,
          311629305,
          415708136,
          453758040,
          376922331,
          346208702
        ],
        [
          "Category 2",
          353367769,
          282036035,
          351400930,
          298937207,
          426118117,
          325722321,
          437696815,
          332358553,
          456126030,
          342310549,
          370874773,
          468411591
        ],
        [
          "Category 3",
          448744106,
          407324740,
          440175978,
          454265913,
          389144215,
          437646705,
          352815960,
          352686817,
          473015480,
          426036357,
          455001536,
          378358294
        ],
        [
          "Category 4",
          304384905,
          258205076,
          260693276,
          222851728,
          256622360,
          351930730,
          371226049,
          388657988,
          351120722,
          409791559,
          352554439,
          298515568
        ],
        [
          "Category 5",
          544744941,
          512268106,
          471720280,
          433756410,
          454441276,
          456497460,
          457594937,
          476508584,
          378555903,
          505462962,
          416328588,
          530129839
        ],
        [
          "Category 6",
          307827898,
          286106077,
          282459935,
          217024932,
          219974599,
          246698375,
          342041557,
          353848075,
          385024172,
          303245957,
          285109236,
          327442276
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-area-2x",
    "name": "STACKED_AREA_2X",
    "label": "Stacked Area 2x",
    "mappings": {
      "openxml": {
        "element": "areaChart",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Area",
    "groupSort": 5,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 29,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          95813,
          52237,
          70946,
          67905,
          67954,
          98555,
          38010,
          77e3,
          72021,
          32241,
          96356,
          21114
        ],
        [
          "Value 2",
          47196,
          77561,
          97012,
          92960,
          91167,
          53933,
          22240,
          40784,
          98184,
          50687,
          39444,
          36100
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-area-3x",
    "name": "STACKED_AREA_3X",
    "label": "Stacked Area 3x",
    "mappings": {
      "openxml": {
        "element": "areaChart",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Area",
    "groupSort": 5,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 30,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          29313,
          13201,
          16057,
          42092,
          72277,
          90120,
          19545,
          69692,
          64321,
          92544,
          85454,
          35485
        ],
        [
          "Value 2",
          60328,
          74799,
          62383,
          41979,
          29342,
          95990,
          10726,
          23970,
          65724,
          38683,
          33053,
          77889
        ],
        [
          "Value 3",
          70889,
          16582,
          83060,
          42662,
          25906,
          69829,
          27477,
          70901,
          97500,
          79616,
          83259,
          88047
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-bar-2x",
    "name": "STACKED_BAR_2X",
    "label": "Stacked Bar 2x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 23,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value 1",
          36158,
          70332,
          55830,
          50001,
          39831,
          39219
        ],
        [
          "Value 2",
          13101,
          96511,
          35313,
          62227,
          53025,
          46517
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-bar-3x",
    "name": "STACKED_BAR_3X",
    "label": "Stacked Bar 3x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "bar",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 6,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Bar",
    "groupSort": 4,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 24,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Value 1",
          19099,
          46585,
          56025,
          94080,
          76768,
          62386
        ],
        [
          "Value 2",
          99065,
          80282,
          53404,
          13617,
          25118,
          44237
        ],
        [
          "Value 3",
          33405,
          86099,
          44795,
          15014,
          24208,
          88193
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-column-2x",
    "name": "STACKED_COLUMN_2X",
    "label": "Stacked Column 2x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "col",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Column",
    "groupSort": 1,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 3,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value 1",
          81426,
          64987,
          38893,
          68878,
          87236,
          46463,
          10851,
          30926
        ],
        [
          "Value 2",
          65392,
          54597,
          46421,
          30379,
          38221,
          54118,
          23396,
          22156
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-column-3x",
    "name": "STACKED_COLUMN_3X",
    "label": "Stacked Column 3x",
    "mappings": {
      "openxml": {
        "element": "barChart",
        "barDir": "col",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 8,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Column",
    "groupSort": 1,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 4,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Value 1",
          59797,
          22676,
          57052,
          55082,
          89131,
          44671,
          15695,
          70217
        ],
        [
          "Value 2",
          80284,
          26361,
          59615,
          20328,
          82357,
          48427,
          92397,
          91070
        ],
        [
          "Value 3",
          57400,
          85674,
          35203,
          19116,
          16006,
          96673,
          39871,
          47930
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-line-2x",
    "name": "STACKED_LINE_2X",
    "label": "Stacked Line 2x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 13,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          96374,
          66498,
          56438,
          65519,
          63883,
          71213,
          17100,
          98259,
          95649,
          94696,
          22899,
          17944
        ],
        [
          "Value 2",
          62772,
          54473,
          24322,
          42591,
          35112,
          34931,
          80292,
          68800,
          28373,
          65296,
          34050,
          46509
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-line-3x",
    "name": "STACKED_LINE_3X",
    "label": "Stacked Line 3x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "grouping": "stacked",
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 17,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          19016,
          42018,
          58434,
          47353,
          30676,
          67433,
          81200,
          49651,
          90173,
          95717,
          79329,
          11025
        ],
        [
          "Value 2",
          97538,
          82692,
          49240,
          96951,
          23577,
          27601,
          44664,
          25129,
          24029,
          82512,
          30374,
          45697
        ],
        [
          "Value 3",
          46930,
          89276,
          37607,
          54942,
          36685,
          93130,
          44600,
          76244,
          74032,
          42914,
          16658,
          22097
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-line-with-markers-2x",
    "name": "STACKED_LINE_WITH_MARKERS_2X",
    "label": "Stacked Line with Markers 2x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "grouping": "stacked",
        "marker": true,
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 2,
    "seriesGroups": 1,
    "slideNumber": 14,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$3",
    "complexity": "simple",
    "dataColumns": [
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
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          70637,
          42742,
          19880,
          68082,
          82132,
          22833,
          16630,
          95477,
          80855,
          11934,
          22224,
          40982
        ],
        [
          "Value 2",
          31798,
          63269,
          73653,
          73092,
          38016,
          62565,
          17685,
          31579,
          59672,
          10282,
          61173,
          44760
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "stacked-line-with-markers-3x",
    "name": "STACKED_LINE_WITH_MARKERS_3X",
    "label": "Stacked Line with Markers 3x",
    "mappings": {
      "openxml": {
        "element": "lineChart",
        "grouping": "stacked",
        "marker": true,
        "composition": "single"
      }
    },
    "categories": 12,
    "columns": [
      "Series 1",
      "Value 1",
      "Value 2",
      "Value 3"
    ],
    "group": "Line",
    "groupSort": 2,
    "series": 3,
    "seriesGroups": 1,
    "slideNumber": 18,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$M$4",
    "complexity": "simple",
    "dataColumns": [
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
      },
      {
        "name": "Value 3",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Series 1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026",
        "Q4 2026"
      ],
      "rows": [
        [
          "Value 1",
          93136,
          65518,
          46265,
          15778,
          10464,
          53719,
          27146,
          93507,
          44335,
          31178,
          67912,
          82309
        ],
        [
          "Value 2",
          66057,
          83519,
          11267,
          24663,
          19862,
          29536,
          81511,
          14722,
          58393,
          86350,
          82420,
          29410
        ],
        [
          "Value 3",
          66333,
          26704,
          15482,
          50404,
          57795,
          15229,
          56898,
          37535,
          99399,
          42706,
          97416,
          23473
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "treemap",
    "name": "TREEMAP",
    "label": "Treemap",
    "mappings": {
      "openxml": {
        "element": "treemapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 6,
    "columns": [
      "Level1",
      "Series1"
    ],
    "group": "Treemap",
    "groupSort": 8,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 43,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Level1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Level1",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025"
      ],
      "rows": [
        [
          "Series1",
          21164,
          42530,
          25525,
          83147,
          64548,
          89471
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "treemap-2x",
    "name": "TREEMAP_2X",
    "label": "Treemap 2x",
    "mappings": {
      "openxml": {
        "element": "treemapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 6,
    "columns": [
      "Level1",
      "Level2",
      "Series1"
    ],
    "group": "Treemap",
    "groupSort": 8,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 44,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$G$3",
    "complexity": "hierarchical",
    "dataColumns": [
      {
        "name": "Level1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Level2",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Level1",
        "Level2",
        "Value"
      ],
      "rows": [
        [
          "Technology",
          "Software",
          96
        ],
        [
          "Technology",
          "Hardware",
          99
        ],
        [
          "Technology",
          "Services",
          48
        ],
        [
          "Finance",
          "Banking",
          86
        ],
        [
          "Finance",
          "Insurance",
          68
        ],
        [
          "Healthcare",
          "Pharma",
          77
        ],
        [
          "Healthcare",
          "Devices",
          76
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "treemap-3x",
    "name": "TREEMAP_3X",
    "label": "Treemap 3x",
    "mappings": {
      "openxml": {
        "element": "treemapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 16,
    "columns": [
      "Level1",
      "Level2",
      "Level3",
      "Series1"
    ],
    "group": "Treemap",
    "groupSort": 8,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 45,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$Q$4",
    "complexity": "hierarchical",
    "dataColumns": [
      {
        "name": "Level1",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Level2",
        "role": "helper",
        "type": "number",
        "position": "row1_col0"
      },
      {
        "name": "Level3",
        "role": "series",
        "type": "number",
        "position": "row2_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row3_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Level1",
        "Level2",
        "Level3",
        "Value"
      ],
      "rows": [
        [
          "North",
          "Tech",
          "Software",
          58
        ],
        [
          "North",
          "Tech",
          "Hardware",
          95
        ],
        [
          "North",
          "Finance",
          "Banking",
          74
        ],
        [
          "North",
          "Finance",
          "Insurance",
          59
        ],
        [
          "South",
          "Tech",
          "Software",
          92
        ],
        [
          "South",
          "Tech",
          "Hardware",
          99
        ],
        [
          "South",
          "Finance",
          "Banking",
          27
        ],
        [
          "South",
          "Finance",
          "Insurance",
          98
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "united-kingdom",
    "name": "UNITED_KINGDOM",
    "label": "United Kingdom",
    "mappings": {
      "openxml": {
        "element": "mapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 4,
    "columns": [
      "State",
      "Value"
    ],
    "group": "Map",
    "groupSort": 12,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 69,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$E$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "State",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "State",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024"
      ],
      "rows": [
        [
          "Value",
          33218,
          92306,
          74764,
          70811
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "united-states",
    "name": "UNITED_STATES",
    "label": "United States",
    "mappings": {
      "openxml": {
        "element": "mapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 11,
    "columns": [
      "State",
      "Value"
    ],
    "group": "Map",
    "groupSort": 12,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 67,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$L$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "State",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "State",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025",
        "Q1 2026",
        "Q2 2026",
        "Q3 2026"
      ],
      "rows": [
        [
          "Value",
          39041,
          53655,
          32037,
          20011,
          76910,
          92998,
          24945,
          79547,
          76840,
          35415,
          55793
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "waterfall",
    "name": "WATERFALL",
    "label": "Waterfall",
    "mappings": {
      "openxml": {
        "element": "waterfallChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 8,
    "columns": [
      "Category",
      "Series1"
    ],
    "group": "Other",
    "groupSort": 13,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 74,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$I$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Category",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Series1",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Category",
        "Q1 2024",
        "Q2 2024",
        "Q3 2024",
        "Q4 2024",
        "Q1 2025",
        "Q2 2025",
        "Q3 2025",
        "Q4 2025"
      ],
      "rows": [
        [
          "Series1",
          88282,
          59377,
          30218,
          31266,
          33703,
          91885,
          31697,
          67366
        ]
      ]
    }
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-chart-type/v1",
    "id": "world",
    "name": "WORLD",
    "label": "World",
    "mappings": {
      "openxml": {
        "element": "mapChart",
        "composition": "extension",
        "notes": "Office extension chart; exact extension markup is renderer-specific."
      }
    },
    "categories": 14,
    "columns": [
      "Country",
      "Value"
    ],
    "group": "Map",
    "groupSort": 12,
    "series": 1,
    "seriesGroups": 1,
    "slideNumber": 66,
    "useSecondaryCategories": false,
    "workbookRange": "Sheet1!$A$1:$O$2",
    "complexity": "simple",
    "dataColumns": [
      {
        "name": "Country",
        "role": "categoryLabel",
        "type": "string",
        "position": "row0_col0"
      },
      {
        "name": "Value",
        "role": "series",
        "type": "number",
        "position": "row1_col0"
      }
    ],
    "sampleData": {
      "headers": [
        "Country",
        "Cat 1",
        "Cat 2",
        "Cat 3",
        "Cat 4",
        "Cat 5",
        "Cat 6",
        "Cat 7",
        "Cat 8",
        "Cat 9",
        "Cat 10",
        "Cat 11",
        "Cat 12",
        "Cat 13",
        "Cat 14"
      ],
      "rows": [
        [
          "Value",
          70305,
          57428,
          21551,
          67240,
          23875,
          41891,
          67104,
          87184,
          62487,
          78676,
          20308,
          61873,
          50668,
          54500
        ]
      ]
    }
  }
];
var narratives = [
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "problem-solution",
    "name": "Problem \u2192 Solution",
    "summary": "Classic business arc: name the pain, raise the stakes, present your fix, show how it works, prove it, ask. The default for sales decks, internal proposals, and most general business presentations.",
    "audienceFit": [
      "customers",
      "stakeholders",
      "executives",
      "internal-teams"
    ],
    "durationRange": {
      "minMinutes": 5,
      "maxMinutes": 30
    },
    "tags": [
      "business",
      "sales",
      "general",
      "proposal"
    ],
    "beats": [
      {
        "id": "hook",
        "name": "Hook",
        "description": "Open with a striking question, statistic, customer quote, or moment that earns the audience's attention. The goal is to make them want to hear what comes next, not to convey information.",
        "layoutHint": "title-center"
      },
      {
        "id": "problem",
        "name": "The Problem",
        "description": "Name the pain in concrete terms. Make it visceral and specific \u2014 describe who hurts, how, and what they're trying to do today that isn't working. Avoid abstractions; use real examples or scenarios the audience recognizes."
      },
      {
        "id": "stakes",
        "name": "Why It Matters",
        "description": "Quantify the cost of inaction or the upside of action. Use numbers, trends, customer impact, competitive pressure \u2014 whatever makes the audience feel the size of the problem and care about solving it now rather than later."
      },
      {
        "id": "solution",
        "name": "The Solution",
        "description": "Reveal your approach and what it produces for the customer. Lead with the outcome, not the architecture. Keep it concrete: what does the audience get, and what changes for them?"
      },
      {
        "id": "mechanism",
        "name": "How It Works",
        "description": "Show the moving parts that make the solution credible. Walk through the key mechanism, workflow, or technical insight that explains why this approach succeeds where others have failed. Enough detail to earn trust; not so much that you lose the room."
      },
      {
        "id": "evidence",
        "name": "Proof",
        "description": "Demonstrate the solution works. Use customer logos, before/after metrics, demos, case studies, third-party validation \u2014 whatever de-risks the claim. One strong piece of proof beats three weak ones."
      },
      {
        "id": "ask",
        "name": "The Ask",
        "description": "State a clear, specific call to action. What do you want the audience to do, decide, or commit to next? Make the smallest credible ask that moves things forward, and make it unambiguous.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "scqa",
    "name": "SCQA (Situation\u2013Complication\u2013Question\u2013Answer)",
    "summary": "Barbara Minto's pyramid-principle arc: surface the recommendation up front, then layer key arguments and supporting evidence beneath it. The default for executive memos, strategic recommendations, and consulting decks where the audience needs the answer fast.",
    "audienceFit": [
      "executives",
      "boards",
      "leadership-teams"
    ],
    "durationRange": {
      "minMinutes": 5,
      "maxMinutes": 20
    },
    "tags": [
      "executive",
      "strategy",
      "consulting",
      "minto",
      "pyramid"
    ],
    "beats": [
      {
        "id": "situation",
        "name": "Situation",
        "description": "Establish the shared context: what is true today that the audience already agrees on. State only facts the audience accepts without argument. The goal is alignment, not persuasion \u2014 you are setting the stage."
      },
      {
        "id": "complication",
        "name": "Complication",
        "description": "Introduce the disturbance to the situation: what changed, what is at risk, what is no longer working. This is the tension that makes the audience lean in. Be specific and quantify the change where possible."
      },
      {
        "id": "question",
        "name": "Key Question",
        "description": "Surface the question the complication forces the audience to answer. Frame it explicitly \u2014 'Should we\u2026?', 'How do we\u2026?', 'What changes if\u2026?'. The question should feel inevitable given the complication."
      },
      {
        "id": "answer",
        "name": "Answer",
        "description": "Deliver the recommendation in a single sentence, up front. No arguments yet, no caveats \u2014 just the conclusion the rest of the deck will defend. This is the apex of the Minto pyramid; everything that follows supports it.",
        "layoutHint": "title-left"
      },
      {
        "id": "key-arguments",
        "name": "Key Arguments",
        "description": "Lay out the two or three top-level reasons the answer is correct. One slide per argument, or one summary slide naming all of them. Each argument should stand alone as a compelling reason; together they should be exhaustive of the case."
      },
      {
        "id": "supporting-evidence",
        "name": "Supporting Evidence",
        "description": "Present the data, examples, and case studies that ground each argument. Pyramid-principle style: every claim above is backed by something verifiable here. Cite sources; show the numbers; let the evidence carry the weight."
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "strategic-narrative",
    "name": "Strategic Narrative",
    "summary": "The change-driven founder/sales arc: a tectonic shift creates winners and losers, the audience must respond, and your product is the only credible way to land in the winners' camp. Used for top-of-funnel sales pitches, board re-positioning, and high-stakes founder talks.",
    "audienceFit": [
      "customers",
      "prospects",
      "board",
      "investors",
      "executives"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "strategic",
      "sales",
      "positioning",
      "category"
    ],
    "beats": [
      {
        "id": "shift",
        "name": "The Shift",
        "description": "Open by naming a large, undeniable change in the world that the audience already half-believes. Technology, regulation, customer behavior, economics \u2014 pick the shift that recasts the audience's reality. The shift, not your product, is the protagonist of the first half of the deck."
      },
      {
        "id": "stakes",
        "name": "Winners and Losers",
        "description": "Make the consequences of the shift concrete. Who wins, who loses, by how much, on what timeframe. Use specific examples \u2014 companies, products, segments \u2014 that have already moved or are about to. The audience should feel that standing still is the riskiest choice."
      },
      {
        "id": "promised-land",
        "name": "Promised Land",
        "description": "Paint a vivid picture of the future state your audience could occupy if they navigate the shift well. Describe outcomes, not features. The promised land must feel desirable, achievable, and meaningfully different from where they are today."
      },
      {
        "id": "obstacles",
        "name": "Old Game",
        "description": "Show why the existing playbook can't get the audience to the promised land. Name the legacy approach honestly and credit what it once did, then explain why the shift has rendered it insufficient. Avoid strawmen \u2014 the more fairly you state the old game, the more credible your new game becomes."
      },
      {
        "id": "mechanism",
        "name": "New Game",
        "description": "Introduce your category-defining approach as the way to play the new game. Show the principles or capabilities that make it possible only now. Emphasize what's structurally different from the old game, not what's marginally better."
      },
      {
        "id": "evidence",
        "name": "Evidence",
        "description": "Prove the new game works. Customer outcomes, named logos, before/after data, third-party validation. Choose evidence that maps directly to the shift you opened with \u2014 proof that other audiences in the same boat made it to the promised land."
      },
      {
        "id": "ask",
        "name": "Call to Action",
        "description": "Close with the single decision you want the audience to make. Frame it as the obvious next move given the shift, the stakes, and the new game. Make it small enough to say yes to today and large enough to start a real engagement.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "golden-circle",
    "name": "Golden Circle (Why / How / What)",
    "summary": "Simon Sinek's keynote arc: lead with belief, follow with method, finish with proof. Best for brand stories, mission-driven keynotes, and any deck where the audience needs to feel why before they can evaluate what.",
    "audienceFit": [
      "customers",
      "employees",
      "general-audience",
      "press"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "keynote",
      "brand",
      "mission",
      "sinek"
    ],
    "beats": [
      {
        "id": "why",
        "name": "Why",
        "description": "Open with the belief or purpose that animates the work. Why does this exist, and why should anyone care beyond commerce? State it plainly and emotionally \u2014 the why is meant to be felt before it is understood."
      },
      {
        "id": "how",
        "name": "How",
        "description": "Translate the belief into the principles that guide how you operate. The values, decisions, and trade-offs that make your approach distinctive. The 'how' is what people who share your why recognize as familiar."
      },
      {
        "id": "what",
        "name": "What",
        "description": "Show the products, services, or outputs that the why and how produce. Concrete examples, not abstractions. The what is the artifact of the belief \u2014 proof that the why is more than rhetoric."
      },
      {
        "id": "proof",
        "name": "Proof",
        "description": "Demonstrate the impact in lives, customers, or outcomes. Stories beat statistics here; specific people and moments earn the audience's belief better than aggregate numbers. End with proof that what you do works because of why you do it."
      },
      {
        "id": "invitation",
        "name": "Invitation",
        "description": "Close by inviting the audience to share the belief \u2014 to buy, build, join, or evangelize. The strongest invitations don't argue; they assume alignment and offer a way in.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "conference-talk",
    "name": "Conference Talk",
    "summary": "Stage-talk arc for a 15\u201345 minute conference or industry-event session: hook the room, promise a payoff, deliver evidence, expose the underlying mechanism, show how to apply it, and end with a memorable recap. Engineered for audiences that came to learn something they can use Monday.",
    "audienceFit": [
      "practitioners",
      "general-audience",
      "industry-peers"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "talk",
      "conference",
      "keynote",
      "education"
    ],
    "beats": [
      {
        "id": "hook",
        "name": "Hook",
        "description": "Earn the first sixty seconds with a story, surprising claim, or vivid moment. Make the audience curious enough to put their phones down. Avoid agendas, bios, and 'today I'm going to talk about' openings \u2014 those are filler that competes with your real opening."
      },
      {
        "id": "promise",
        "name": "Promise",
        "description": "Tell the audience exactly what they'll know, feel, or be able to do by the end of the talk. A clear promise sets the implicit contract for the next thirty minutes and lets you redirect attention later when needed."
      },
      {
        "id": "evidence",
        "name": "Evidence",
        "description": "Deliver the substantive case for your promise. Data, examples, demonstrations, or strong stories \u2014 whatever a skeptical attendee would need to update their beliefs. This is the densest section of the talk; pace and visualize accordingly."
      },
      {
        "id": "mechanism",
        "name": "Mechanism",
        "description": "Reveal the underlying principle or framework that explains why the evidence holds. The mechanism is what audiences quote later \u2014 the moment of 'oh, that's why.' Keep it crisp and namable."
      },
      {
        "id": "application",
        "name": "Application",
        "description": "Show the audience how to use the mechanism in their own work. Concrete, specific, low-friction first steps. The talk earns its keep here \u2014 abstract insight without an applied path is forgotten by lunch."
      },
      {
        "id": "recap",
        "name": "Recap",
        "description": "Restate the promise, the mechanism, and the call to action in a single short slide. Give the audience the line they'll repeat to a colleague and the one image that will stick with them after the lights come up.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "transformation-arc",
    "name": "Transformation Arc (Before / After / Bridge)",
    "summary": "Marketing-copy arc adapted for slides: paint the painful 'before,' contrast it with a vivid 'after,' then deliver the bridge that gets the audience from one to the other. Tight, persuasive, and ideal for short pitches, landing-page-style decks, and product-marketing teasers.",
    "audienceFit": [
      "customers",
      "prospects",
      "marketing-teams",
      "general-audience"
    ],
    "durationRange": {
      "minMinutes": 3,
      "maxMinutes": 15
    },
    "tags": [
      "marketing",
      "copywriting",
      "pitch",
      "persuasive"
    ],
    "beats": [
      {
        "id": "before",
        "name": "Before",
        "description": "Describe the audience's current world in the first person they recognize. Specific frustrations, specific costs, specific moments of friction. The clearer the 'before' lands, the more the rest of the deck has to push against."
      },
      {
        "id": "after",
        "name": "After",
        "description": "Paint the world the audience could be in instead. Concrete outcomes, not feature lists \u2014 what a day looks like, what a quarter feels like, what becomes effortless that used to hurt. Make it desirable and credible at the same time."
      },
      {
        "id": "bridge",
        "name": "Bridge",
        "description": "Show the path from before to after: the product, service, or change that closes the gap. Lead with the simplest user-visible thing they do; the architecture can wait. The bridge must feel proportionate to the transformation it promises."
      },
      {
        "id": "evidence",
        "name": "Evidence",
        "description": "Prove the bridge has carried others across. One or two strong customer stories, before/after metrics, or named logos with concrete outcomes. Choose proof that maps directly to the 'after' you painted, not generic credibility markers."
      },
      {
        "id": "ask",
        "name": "Ask",
        "description": "Close with the single low-friction action that starts the audience across the bridge. Make it small enough to act on now and meaningful enough to count as commitment.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "pitch-deck",
    "name": "Startup Pitch Deck",
    "summary": "The canonical investor-pitch arc, drawn from Sequoia and Y Combinator's templates. Optimized for 10\u201320 minute meetings with VCs and angels. Each beat answers the question an investor will ask next.",
    "audienceFit": [
      "investors",
      "venture-capitalists",
      "angels",
      "advisors"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 20
    },
    "tags": [
      "startup",
      "fundraising",
      "pitch",
      "investor"
    ],
    "beats": [
      {
        "id": "opening",
        "name": "Opening",
        "description": "Open with the company name, logo, and a one-line tagline that doubles as a positioning statement. Set the visual tone for the deck. Keep it confident and uncluttered \u2014 this is the cover.",
        "layoutHint": "title-left"
      },
      {
        "id": "purpose",
        "name": "Company Purpose",
        "description": "State in a single sentence what the company does and why it exists. Should be immediately understandable without industry jargon. Often doubles as the answer to 'so what do you do?'"
      },
      {
        "id": "problem",
        "name": "Problem",
        "description": "Describe the pain point you solve. Make it concrete with a specific user or customer scenario. The more visceral and recognizable the problem, the stronger the rest of the pitch lands."
      },
      {
        "id": "why-now",
        "name": "Why Now",
        "description": "Explain the technological, regulatory, behavioral, or market shift that makes this opportunity possible today and impossible five years ago. Investors want to know why this is a window, not just an idea."
      },
      {
        "id": "market",
        "name": "Market Size",
        "description": "Size the opportunity. Top-down (TAM/SAM/SOM) or bottom-up (units \xD7 price). Show how big the prize is if you win, and why this market is attractive to a venture-scale outcome."
      },
      {
        "id": "competition",
        "name": "Competition",
        "description": "Map the competitive landscape honestly. A 2x2 matrix or feature-comparison grid is fine; what matters is showing you understand the alternatives and where you uniquely fit. Na\xEFve 'no competition' answers tank credibility."
      },
      {
        "id": "solution",
        "name": "Solution",
        "description": "Show how you solve the problem and why your approach is uniquely better. Lead with the outcome for the customer, then show the mechanism. This is where you connect problem to product."
      },
      {
        "id": "product",
        "name": "Product",
        "description": "Give the product its own moment. Screenshots or a key visual that captures what users actually see and feel. Pick one strong frame over a montage of small ones."
      },
      {
        "id": "demo",
        "name": "Demo",
        "description": "Walk through the core user flow end-to-end. Show real software solving a real problem in a real workflow \u2014 not a marketing reel. If a live demo is too risky, use a tightly edited recording with narration."
      },
      {
        "id": "traction",
        "name": "Traction",
        "description": "Prove momentum with one credible headline metric. Revenue, users, growth rate, customer logos \u2014 whatever best shows the business is working. One strong chart beats five vanity numbers."
      },
      {
        "id": "growth",
        "name": "Growth Drivers",
        "description": "Show how the headline metric got there and where it's going. Cohorts, retention, expansion, channel mix \u2014 whatever explains the engine behind the number. Investors back the trajectory, not the snapshot."
      },
      {
        "id": "business-model",
        "name": "Business Model",
        "description": "Explain how the company makes money. Pricing, unit economics, sales motion, payback period. Should answer: what does it cost to acquire a customer, and what do they pay you?"
      },
      {
        "id": "team",
        "name": "Team",
        "description": "Establish why this team uniquely wins this market. Founder backgrounds, relevant experience, prior outcomes, key advisors. Investors back people first; make the case."
      },
      {
        "id": "financials",
        "name": "Financials",
        "description": "Show the financial picture: historical revenue, burn, runway, and forward projection. Be conservative-but-credible \u2014 investors will discount aggressive numbers and reward defensible ones."
      },
      {
        "id": "ask",
        "name": "The Ask",
        "description": "State the round size, intended use of funds, and what milestones the capital takes you to. Be specific \u2014 investors should leave knowing exactly what you want and what they get.",
        "layoutHint": "title-left"
      },
      {
        "id": "closing",
        "name": "Closing",
        "description": "Close on a strong final image: logo, contact info, and the one line you most want the investor to remember. Leave space for the conversation that follows.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "early-startup-pitch",
    "name": "Early-Stage Startup Pitch",
    "summary": "Seed and pre-seed pitch arc tuned for vision-heavy stories where revenue and traction are still thin. Anchors the narrative in market change, founder insight, and credible early signal \u2014 not metrics yet.",
    "audienceFit": [
      "seed-investors",
      "angels",
      "advisors"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 20
    },
    "tags": [
      "startup",
      "fundraising",
      "seed",
      "pitch"
    ],
    "beats": [
      {
        "id": "logo",
        "name": "Logo",
        "description": "Cover slide with the company name, logo, and one-line positioning. Simple, branded, confident.",
        "layoutHint": "title-left",
        "instructions": "Establish presence",
        "slideType": "text"
      },
      {
        "id": "monumental-change",
        "name": "Monumental Change",
        "description": "Open by naming a large, undeniable shift in the world. Tech, regulatory, behavioral. The shift is the reason this company exists \u2014 investors should feel its weight before they hear about the product.",
        "instructions": "Highlight market transformation",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "past-struggle",
        "name": "Past Struggle",
        "description": "Show what the world tried to do about the problem before the shift, and why those approaches fell short. Honest credit to predecessors makes the new game more credible.",
        "instructions": "Emphasize previous challenges",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "innovative-breakthrough",
        "name": "Innovative Breakthrough",
        "description": "Present the founding insight or breakthrough that makes a new approach possible. This is the 'secret' the company is built on \u2014 name it plainly.",
        "instructions": "Present innovative solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "unique-offering",
        "name": "Unique Offering",
        "description": "Detail the product or service. Lead with the customer-visible thing they touch; the architecture can wait. Show why this offering is structurally different from the past struggle.",
        "instructions": "Detail product or service",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "costly-issues",
        "name": "Costly Issues",
        "description": "Quantify the pain customers experience without your offering. Time, dollars, opportunity cost. Specific numbers convert sympathy into urgency.",
        "instructions": "Quantify problems faced",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "effective-solutions",
        "name": "Effective Solutions",
        "description": "Demonstrate the customer outcome your offering produces. Before/after numbers from early users, even small N. Early-stage pitches are won by leading indicators, not by trailing ones.",
        "instructions": "Demonstrate benefits",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "unit-economics",
        "name": "Unit Economics",
        "description": "Explain the financial model. Cost to acquire, gross margin, payback. Investors don't expect maturity \u2014 they expect that you've thought about it.",
        "instructions": "Explain financial model",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "talented-team",
        "name": "Talented Team",
        "description": "Introduce the founders and key early hires. Show why this team uniquely sees and can execute on this opportunity. Insight beats r\xE9sum\xE9 at the seed stage.",
        "instructions": "Introduce key players",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "traction",
        "name": "Traction",
        "description": "Showcase the early signal: pilots, design partners, waitlist, retention data, anything credible. Frame it honestly \u2014 investors at this stage discount inflation aggressively.",
        "instructions": "Showcase accomplishments",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "investment-opportunity",
        "name": "Investment Opportunity",
        "description": "Detail the round size, structure, and use of funds. Tie the raise to specific milestones it takes the company to. Specificity here signals operational maturity.",
        "instructions": "Detail funding needs",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing-logo",
        "name": "Closing Logo",
        "description": "Close on the brand and contact info. Leave the room with the line you most want repeated when the partner pitches you to the rest of the firm.",
        "layoutHint": "title-left",
        "instructions": "Leave a lasting impression",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "venture-pitch",
    "name": "Venture Pitch",
    "summary": "Series A/B fundraising arc structured around the canonical investor questions.",
    "audienceFit": [
      "investors",
      "venture-capitalists",
      "series-a",
      "series-b"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "startup",
      "fundraising",
      "pitch",
      "investor",
      "series-a"
    ],
    "beats": [
      {
        "id": "opening",
        "name": "Opening",
        "instructions": "Establish identity",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "purpose",
        "name": "Purpose",
        "instructions": "State your mission",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "problem",
        "name": "Problem",
        "instructions": "Present the challenge",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "solution",
        "name": "Solution",
        "instructions": "Propose your idea",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "why-now",
        "name": "Why Now",
        "instructions": "Explain timing importance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "market-size",
        "name": "Market Size",
        "instructions": "Demonstrate potential",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "competition",
        "name": "Competition",
        "instructions": "Analyze competitive landscape",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "product",
        "name": "Product",
        "instructions": "Showcase features/benefits",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "business-model",
        "name": "Business Model",
        "instructions": "Detail revenue streams",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "team",
        "name": "Team",
        "instructions": "Highlight key members",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "financials",
        "name": "Financials",
        "instructions": "Show projections/needs",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing",
        "name": "Closing",
        "instructions": "Reinforce brand",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "persuasive-sales",
    "name": "Persuasive Sales",
    "summary": "Top-of-funnel sales arc that creates awareness and alignment with a prospective customer. Anchored in a market change, leading to your unique capabilities, supported by proof, ending with a clear call to action.",
    "audienceFit": [
      "prospects",
      "customers",
      "buyers"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "sales",
      "go-to-market",
      "outbound",
      "discovery"
    ],
    "beats": [
      {
        "id": "intro",
        "name": "Introduction",
        "description": "Open with a brief framing of who you are and why this conversation is worth the prospect's next thirty minutes. Keep credentials short; the audience cares about their problem, not your r\xE9sum\xE9.",
        "instructions": "Name & logo",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "big-change",
        "name": "Big Change",
        "description": "Name the market shift the prospect's industry is living through. Make it concrete, recent, and undeniable. The change \u2014 not the product \u2014 is the reason they should care.",
        "instructions": "Highlight market shift",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "response-to-change",
        "name": "Winners and Losers",
        "description": "Show how the change is creating winners and losers in the prospect's space. Use named examples where you can. The goal is for the prospect to wonder which side they'll end up on.",
        "instructions": "Show winners & losers",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "benefits",
        "name": "Benefits",
        "description": "Paint the outcome a winner experiences: a vivid picture of the prospect's life on the other side of the change. Lead with what changes for them, not with what your product does.",
        "instructions": "Describe benefits, paint a vivid picture",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "capabilities",
        "name": "Capabilities",
        "description": "Reveal the unique capabilities that make those outcomes possible. Frame them as the 'magic gifts' the prospect needs to win the new game. Highlight what's structurally different from the alternatives.",
        "instructions": "Present unique features as 'magic gifts' to the customer",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "evidence",
        "name": "Evidence",
        "description": "Share customer testimonials, case studies, and measurable outcomes from organizations like the prospect's. Pick evidence that maps to the benefits you promised, not generic logos.",
        "instructions": "Share testimonials",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "call-to-action",
        "name": "Call to Action",
        "description": "Ask for the next step in the sales process. Be specific: a pilot, a workshop, a follow-on conversation with a named stakeholder. Make the smallest credible commitment that keeps momentum.",
        "layoutHint": "title-left",
        "instructions": "Encourage decision-making",
        "slideType": "text"
      },
      {
        "id": "close",
        "name": "Close",
        "description": "Close with a final image and contact path. Leave the prospect with one line about why they're better off acting now than later, and clear instructions for how to engage.",
        "layoutHint": "title-left",
        "instructions": "Logo & contact info",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "company-intro",
    "name": "Company Intro",
    "summary": "Standard company-overview deck: who you are, what's distinctive about you, who you serve, and why they win. Built for first-touch sales meetings, partner intros, and 'about us' decks attached to outbound emails.",
    "audienceFit": [
      "prospects",
      "partners",
      "press",
      "candidates"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "overview",
      "go-to-market",
      "marketing",
      "intro"
    ],
    "beats": [
      {
        "id": "logo",
        "name": "Logo",
        "description": "Cover slide with the logo, tagline, and a single line of positioning. Set the visual tone \u2014 confident, branded, uncluttered.",
        "layoutHint": "title-left",
        "instructions": "Establish brand identity",
        "slideType": "text"
      },
      {
        "id": "about",
        "name": "About",
        "description": "Capture the company in three or four lines: what you do, who you do it for, and how long you've been at it. Avoid jargon; an outsider should grok the business in fifteen seconds.",
        "instructions": "Capture attention",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "competitive-advantage",
        "name": "Competitive Advantage",
        "description": "State the one or two things you do that the alternatives can't. Frame it as a structural advantage, not a feature list. The audience should leave able to repeat the differentiator in their own words.",
        "instructions": "Stand out",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "company-story",
        "name": "Company Story",
        "description": "Share the founding insight or origin moment \u2014 why this company exists, told as a short story. Specific people, specific problems, a specific 'aha.' Story beats biography.",
        "instructions": "Share origin",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "offerings",
        "name": "Offerings",
        "description": "Map the products and services into a coherent picture. Show how they fit together rather than listing them flat. The shape of the portfolio is itself a message.",
        "instructions": "Highlight products/services",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "ideal-customer",
        "name": "Ideal Customer",
        "description": "Define who you serve best. Industry, size, role, situation. Specificity here helps the audience self-select and signals you understand the customer well enough to be choosy.",
        "instructions": "Define target market",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "key-benefits",
        "name": "Key Benefits",
        "description": "Translate offerings into three to five customer outcomes. Lead with the result, not the mechanism. Each benefit should answer 'what becomes easier or better for me?'",
        "instructions": "Emphasize value",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "success-story",
        "name": "Success Story",
        "description": "Tell one named customer's story with concrete before/after metrics. A single specific story is more persuasive than a logo grid; pick one that mirrors the audience you're presenting to.",
        "instructions": "Showcase satisfied customer",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing-cta",
        "name": "Closing & CTA",
        "description": "Close with one line of why now and one specific next step \u2014 a discovery call, a pilot, a partner program. End with contact info that's easy to act on without searching.",
        "layoutHint": "title-left",
        "instructions": "Encourage action",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "marketing-strategy",
    "name": "Marketing Strategy",
    "summary": "Comprehensive go-to-market strategy arc structured around the 4Ps. Use for category launches, annual marketing plans, and any deck where the audience needs to see customer, market, competition, and tactics in one coherent picture.",
    "audienceFit": [
      "marketing-leaders",
      "executives",
      "cross-functional-partners"
    ],
    "durationRange": {
      "minMinutes": 30,
      "maxMinutes": 60
    },
    "tags": [
      "go-to-market",
      "marketing",
      "strategy",
      "planning"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Open by establishing the product or service this strategy is for, and what window of time it covers. One slide that tells the audience exactly which world they're being asked to weigh in on.",
        "instructions": "Establish product/service specifics",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "objective",
        "name": "Objective",
        "description": "State the marketing goals in measurable terms: revenue, pipeline, awareness, share. Two or three goals, ranked. Goals without ranking get equal energy and equal mediocrity.",
        "instructions": "Share marketing goals",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "customer",
        "name": "Customer",
        "description": "Detail the target audience. Segments, jobs-to-be-done, decision criteria, where they live in the buying cycle. Specificity here is the foundation everything else stands on.",
        "instructions": "Detail target audience",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "market",
        "name": "Market",
        "description": "Describe the market landscape: size, growth, segments, behavioral trends. Use external data for credibility and your own research for nuance. Show how the market is changing, not just how big it is.",
        "instructions": "Discuss market landscape",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "competition",
        "name": "Competition",
        "description": "Map the competitive set honestly. Direct, indirect, and substitutes. A 2x2 or feature-comparison framework helps; what matters is that the audience trusts your read of the field.",
        "instructions": "Analyze competitive environment",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "strategy",
        "name": "Strategy",
        "description": "Articulate the marketing approach in one sentence and a single supporting frame. Positioning, primary motion, where you choose to play and not play. Clarity here is what makes the tactics that follow coherent.",
        "instructions": "Elaborate marketing approach",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "product",
        "name": "Product",
        "description": "Highlight the unique value the product brings to the strategy. Lead with the customer outcome; tie it directly back to the customer beat. Avoid feature soup.",
        "instructions": "Highlight unique value",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "price",
        "name": "Price",
        "description": "Justify pricing and packaging. Show the logic \u2014 cost-plus, value-based, competitor-anchored \u2014 and the levers you'll use over the period. Price decisions are strategy decisions.",
        "instructions": "Justify pricing strategy",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "place",
        "name": "Place",
        "description": "Describe distribution channels and the role each plays. Direct, partner, marketplace, retail. Channel mix is often where strategies quietly succeed or fail.",
        "instructions": "Discuss distribution channels",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "promotion",
        "name": "Promotion",
        "description": "Reveal the campaign and content tactics that bring the strategy to market. Pair each tactic with the audience and metric it serves. Avoid listing channels for their own sake.",
        "instructions": "Reveal promotional tactics",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "summary",
        "name": "Summary",
        "description": "Recap the strategy in a single page: customer, position, motion, expected outcome. End with the decision or commitment you need from the audience.",
        "layoutHint": "title-left",
        "instructions": "Recap key points",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "product-launch",
    "name": "Product Launch",
    "summary": "Persuasive launch arc: open with brand, hook with a promise, set the conflict, raise the stakes, reveal the product, raise stakes again, sell, and call to action. Tuned for keynote-style launches and major announcement decks.",
    "audienceFit": [
      "customers",
      "press",
      "general-audience",
      "partners"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "startup",
      "launch",
      "marketing",
      "keynote"
    ],
    "beats": [
      {
        "id": "opening",
        "name": "Opening",
        "description": "Open with the company brand and a confident visual. Set the tone \u2014 this is a moment, not a meeting. One slide that signals the audience is somewhere worth being.",
        "layoutHint": "title-left",
        "instructions": "Show company branding",
        "slideType": "text"
      },
      {
        "id": "promise",
        "name": "Promise",
        "description": "Hook the audience with the promise of the talk. Tell them, in one sentence, what they're about to see and why it matters to them. Specific promises buy patient audiences.",
        "instructions": "Hook the audience",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "context",
        "name": "Context",
        "description": "Set the stage with the world the product enters. The customer reality, the market state, the unmet expectation. Context turns the launch from a product release into a moment in a larger story.",
        "instructions": "Set the stage",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conflict",
        "name": "Conflict",
        "description": "Introduce the villain \u2014 the problem, friction, or status quo the product opposes. Make the conflict concrete enough that the audience can name a moment they've felt it themselves.",
        "instructions": "Introduce villain/problem",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "stakes",
        "name": "Stakes",
        "description": "Emphasize what's at risk if the conflict isn't resolved. Quantify, personalize, dramatize. Stakes are what convert a curious audience into an invested one.",
        "instructions": "Emphasize importance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "reveal",
        "name": "Reveal",
        "description": "Showcase the product. One striking visual, one defining capability, one sentence that captures what's new. Earn the applause line; don't bury it under a bullet list.",
        "instructions": "Showcase the solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "raise-stakes",
        "name": "Raise the Stakes",
        "description": "Highlight where the alternatives fall short and what they cost the customer. Re-energize the room midway by sharpening the contrast with the reveal.",
        "instructions": "Highlight shortcomings of alternatives",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "raise-stakes-again",
        "name": "Reinforce the Need",
        "description": "Reinforce why change is non-negotiable now. A second beat of stakes, framed differently \u2014 perhaps a customer voice or a future cost. Cement the reason to act.",
        "instructions": "Reinforce the need for change",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "sell",
        "name": "Sell",
        "description": "Make the audience want the product. Lead with the outcome it produces in their lives. Pricing, packaging, availability go here, but only after the desire is built.",
        "instructions": "Make them want your solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "cta",
        "name": "Call to Action",
        "description": "Close with the single action you want from the audience. Pre-order, sign up, attend, share. Make it simple, specific, and immediate.",
        "layoutHint": "title-left",
        "instructions": "Inspire action",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "strategic-advisory",
    "name": "Strategic Advisory",
    "summary": "Consulting-style advisory deck applying Minto's pyramid: title, situation/complication/question, the answer in one sentence, and three argued points with a process. Use when the audience expects a recommendation and the case for it, in that order.",
    "audienceFit": [
      "executives",
      "boards",
      "leadership-teams",
      "clients"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "consulting",
      "advisory",
      "strategy",
      "minto"
    ],
    "beats": [
      {
        "id": "title",
        "name": "Title",
        "description": "Open with a one-line summary statement that captures the recommendation, not the topic. The title slide is the headline of the entire engagement \u2014 make it specific enough that someone reading only this slide already understands the position.",
        "layoutHint": "title-left",
        "instructions": "Brief summary sentence",
        "slideType": "text"
      },
      {
        "id": "scq",
        "name": "Situation, Complication, Question",
        "description": "Frame the engagement on a single slide: the relevant status quo, what needs to change, and the question that needs to be resolved. This is the SCQ shorthand \u2014 context, tension, prompt. Don't yet answer."
      },
      {
        "id": "answer",
        "name": "Answer",
        "description": "Deliver the recommendation in a single sentence. No arguments yet, no caveats. The answer is the apex of the pyramid; the rest of the deck supports it.",
        "instructions": "A solution in one sentence, no arguments yet",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "arguments",
        "name": "Arguments",
        "description": "Preview the three top-level arguments that defend the answer. One slide naming all three so the audience knows where the deck is going. Each argument should be a complete claim, not a topic.",
        "instructions": "Support the solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "argument-1",
        "name": "Argument 1",
        "description": "Develop the first argument with supporting data, examples, and reasoning. Lead with the claim, then the evidence \u2014 Minto-style. The slide should stand alone if pulled out.",
        "instructions": "First key point",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "argument-2",
        "name": "Argument 2",
        "description": "Develop the second argument the same way. Vary the type of evidence \u2014 quantitative, qualitative, comparative \u2014 so the audience hears the case from multiple angles.",
        "instructions": "Second key point",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "argument-3",
        "name": "Argument 3",
        "description": "Develop the third argument and walk through the supporting process or methodology. This is often where the 'how' lives \u2014 the implementation insight that makes the recommendation feel actionable.",
        "instructions": "Third key point with a process",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "summary",
        "name": "Summary",
        "description": "Recap the answer and arguments in a single slide and point to additional resources. Close with the explicit next step you want the audience to take.",
        "layoutHint": "title-left",
        "instructions": "Recap the answer, provide additional resources",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "challenge-resolution",
    "name": "Challenge \u2192 Resolution",
    "summary": "Identify a current business challenge, trace its origins, and recommend an actionable resolution. Useful for management consulting, internal strategy memos, and any deck where the audience needs a clear path from problem to plan.",
    "audienceFit": [
      "executives",
      "managers",
      "stakeholders",
      "internal-teams"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "management",
      "strategy",
      "consulting",
      "advisory"
    ],
    "beats": [
      {
        "id": "hook",
        "name": "Hook",
        "description": "Open with a specific, visible signal of the challenge \u2014 a metric heading the wrong way, a customer story, a competitive event. The hook should make the audience nod that yes, this matters.",
        "instructions": "Capture audience attention",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "dilemma",
        "name": "Dilemma",
        "description": "State the challenge plainly. What is failing, who is feeling it, and why has it now risen to a level that demands a decision? The dilemma must feel real, not academic.",
        "instructions": "Present the problem",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "backdrop",
        "name": "Backdrop",
        "description": "Provide the context behind the dilemma: how it formed, what's been tried, what constraints exist. Just enough history that the audience trusts your diagnosis without drowning in detail.",
        "instructions": "Provide context",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "remedy",
        "name": "Remedy",
        "description": "Propose the resolution. Lead with the recommendation, then sketch the approach. Be opinionated \u2014 vague remedies invite vague responses.",
        "instructions": "Propose a solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "evidence",
        "name": "Evidence",
        "description": "Demonstrate why the remedy will work. Comparable cases, supporting data, or pilot results. Choose evidence that addresses the audience's most likely objection, not the one easiest to answer.",
        "instructions": "Demonstrate success",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "motivate",
        "name": "Motivate",
        "description": "Make the case for acting now. Quantify the cost of delay and the upside of decisive action. Help the audience picture the room a quarter from now if they say yes.",
        "instructions": "Encourage action",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Recap the challenge, the remedy, and the specific decision you need from the audience. End with a clear ask, not a summary slide.",
        "layoutHint": "title-left",
        "instructions": "Recap and end powerfully",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "project-proposal",
    "name": "Project Proposal",
    "summary": "Internal proposal arc for greenlighting a project: hook, problem, idea, benefits, justification, plan, timeline, risks, outlook, ask. Designed to take a sponsor from 'never heard of this' to 'approved' inside a single meeting.",
    "audienceFit": [
      "executives",
      "sponsors",
      "managers",
      "internal-teams"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "management",
      "proposal",
      "internal",
      "planning"
    ],
    "beats": [
      {
        "id": "elevator-pitch",
        "name": "Elevator Pitch",
        "description": "Open with the proposal in one slide: the project name, the audience, the goal, and the headline benefit. If a sponsor reads only this slide, they should still know what they're being asked to approve.",
        "instructions": "Audience hook & objectives",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "problem-statement",
        "name": "Problem Statement",
        "description": "Articulate the problem this project solves and why it deserves resources now. Tie it to a known business goal or pain. Vague problems produce vague approvals.",
        "instructions": "Highlight struggles & project necessity",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "core-concept",
        "name": "Core Concept",
        "description": "Describe the central idea of the project in plain language. The 'what' before the 'how.' A reader should be able to repeat the concept in one sentence after this slide.",
        "instructions": "Share actionable idea",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "benefits",
        "name": "Benefits",
        "description": "Quantify the impact: revenue, cost, risk, customer, capability. Use numbers where possible and clear comparisons where not. Each benefit should map to a metric the sponsor cares about.",
        "instructions": "Spotlight key metrics",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "justification",
        "name": "Justification",
        "description": "Connect the project to broader strategy, OKRs, or constraints the audience already cares about. Show why this project is more important than the alternatives competing for the same resources.",
        "instructions": "Strategic alignment & significance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "approach",
        "name": "Approach",
        "description": "Lay out how the project will be executed: the solution, the team shape, the budget envelope. Enough detail to feel credible, not so much that it pre-commits to choices that will mature in flight.",
        "instructions": "Solution, resources, & budget",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "timeline",
        "name": "Timeline",
        "description": "Show the project phases on a timeline, with major milestones and decision points marked. Sponsors are buying a sequence of bets, not a single launch \u2014 make those bets visible.",
        "instructions": "Outline project phases",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "risks",
        "name": "Risks",
        "description": "Name the top risks honestly and pair each with a mitigation or open question. Listing risks without mitigations signals you haven't thought it through; hiding risks signals worse.",
        "instructions": "Consider potential challenges",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "outlook",
        "name": "Outlook",
        "description": "Paint the picture of what the organization looks like a quarter or year after the project ships. Stretch beyond the immediate deliverable to the second-order benefits.",
        "instructions": "Envision project impact",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "wrap-up",
        "name": "Wrap Up",
        "description": "Recap the proposal and state the specific decision you're asking for: approval, budget, headcount, sponsorship. Make it easy to say yes today.",
        "layoutHint": "title-left",
        "instructions": "Summarize & persuade",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "failure-analysis",
    "name": "Failure Analysis",
    "summary": "Walk through what went wrong, why, and what changes \u2014 a structured post-mortem for stakeholder reviews. Pairs honest accountability with a credible recovery plan.",
    "audienceFit": [
      "leadership",
      "customers",
      "stakeholders",
      "partners"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "postmortem",
      "incident",
      "review",
      "accountability"
    ],
    "beats": [
      {
        "id": "opening-remark",
        "name": "Opening Remark",
        "description": "Set an empathetic, accountable tone before any analysis. Acknowledge the impact on the people in the room and the customers affected. Authenticity here earns you the credibility you'll need for the rest of the deck.",
        "instructions": "Set an empathetic tone",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "incident-breakdown",
        "name": "Incident Breakdown",
        "description": "Walk through what happened, in time order. Stick to facts: what systems, what users, what timeline. No causal claims yet \u2014 just an accurate, neutral reconstruction the audience can trust.",
        "instructions": "Detail the failure",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "impact-analysis",
        "name": "Impact Analysis",
        "description": "Quantify the damage. Customer-hours lost, revenue at risk, SLA breaches, downstream knock-ons. Be specific and direct; vague impact statements undermine the rest of the post-mortem.",
        "instructions": "Describe failure's effects",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "root-cause",
        "name": "Root Cause",
        "description": "Trace the failure to its underlying cause, not the most visible symptom. Use a 'five whys' or fishbone framing if useful. Distinguish between the proximate trigger and the systemic conditions that allowed it.",
        "instructions": "Analyze underlying reasons",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "proposed-solutions",
        "name": "Proposed Solutions",
        "description": "Present the corrective actions you're taking. Lead with the highest-leverage fix; sequence the rest. For each action, name an owner and a date \u2014 solutions without owners are aspirations.",
        "instructions": "Suggest corrective measures",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "action-plan",
        "name": "Action Plan",
        "description": "Lay out the rollout: what ships when, how it's verified, who signs off. Show that 'fixed' has a definition and a deadline, not just intent.",
        "instructions": "Map out steps",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "evaluate-outcome",
        "name": "Evaluate Outcome",
        "description": "Define the metrics that will tell you the fix worked. Pre/post comparisons, monitoring SLOs, error budgets \u2014 whatever proves the failure mode is closed and not just deferred.",
        "instructions": "Assess corrective actions",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "lessons-learned",
        "name": "Lessons Learned",
        "description": "Distill the broader lessons that outlive this specific incident. What does the team or organization now know that it didn't before? What patterns will you watch for elsewhere?",
        "instructions": "Reflect on failure lessons",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "preventive-measures",
        "name": "Preventive Measures",
        "description": "List the systemic safeguards being added \u2014 process changes, automated checks, on-call procedures, review gates. Show how this category of failure becomes harder to recur, not just this specific instance.",
        "instructions": "List safeguards",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing-thoughts",
        "name": "Closing Thoughts",
        "description": "Close with humility and forward momentum. Re-affirm accountability, thank the audience for their patience, and signal confidence in the path forward without overclaiming.",
        "layoutHint": "title-left",
        "instructions": "Empathize, trust, and encourage",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "classic-story",
    "name": "Classic Story",
    "summary": "Movie-style narrative arc applied to any topic: open the scene, introduce the villain, raise the stakes, send in the hero, deliver the plan, and close with hope. A versatile go-to when you need to make information feel like a story.",
    "audienceFit": [
      "general-audience",
      "customers",
      "internal-teams"
    ],
    "durationRange": {
      "minMinutes": 5,
      "maxMinutes": 30
    },
    "tags": [
      "storytelling",
      "general",
      "engagement"
    ],
    "beats": [
      {
        "id": "opening",
        "name": "Opening",
        "description": "Capture attention with a vivid moment, image, or question that sets the world of the story. The audience should immediately know what kind of room they're in. Avoid agendas \u2014 the opening is the first scene, not a preamble.",
        "instructions": "Capture audience attention",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "context",
        "name": "Context",
        "description": "Establish what's normal in this world before anything goes wrong. Just enough background for the audience to feel the stakes when the villain shows up. Keep it tight; backstory is fuel, not the engine.",
        "instructions": "Give background & importance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "villain",
        "name": "Villain",
        "description": "Introduce the antagonist \u2014 a problem, a competitor, a market force, an inertia. Give it a face and a name where you can. The clearer the villain, the more the audience cares about how the story turns out.",
        "instructions": "Introduce problem",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "despair",
        "name": "Despair",
        "description": "Show what's at risk if the villain wins. Emphasize the human or business cost of inaction. Don't rush past this beat \u2014 the discomfort here is what makes the resolution land.",
        "instructions": "Emphasize negative impact",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "hero",
        "name": "Hero",
        "description": "Reveal the hero of the story. Often this is the audience themselves, your team, or your product. Frame the hero by what they uniquely bring to the fight, not by their r\xE9sum\xE9.",
        "instructions": "Present solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "plan",
        "name": "Plan",
        "description": "Walk through how the hero defeats the villain. Concrete, sequential, credible. Generic plans signal weak heroes; specific plans earn belief that the ending you're promising is reachable.",
        "instructions": "Detail implementation",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing",
        "name": "Closing",
        "description": "End with the resolution and the lesson. Show what the world looks like after the villain loses, and leave the audience with the feeling \u2014 and the line \u2014 they'll repeat afterwards.",
        "layoutHint": "title-left",
        "instructions": "Inspire & conclude",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "business-narrative",
    "name": "Business Narrative",
    "summary": "Tell a business strategy or solution as a story: setting, challenge, tension, hero, plan, outcome. Useful for internal alignment decks, town halls, and any audience that responds better to story shape than to bullet lists.",
    "audienceFit": [
      "internal-teams",
      "leadership",
      "cross-functional-partners"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "management",
      "storytelling",
      "internal",
      "strategy"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Engage the audience and set expectations for the next twenty minutes. Tell them you're going to tell them a story \u2014 and then start telling it. Avoid a separate agenda slide; the introduction is the first scene.",
        "instructions": "Engage and set expectations",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "setting",
        "name": "Setting",
        "description": "Establish the world the story takes place in: the team, the market, the moment. Just enough context that the challenge will feel meaningful when it arrives.",
        "instructions": "Establish the environment",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "challenge",
        "name": "Challenge",
        "description": "Identify the issue at hand. Concrete, specific, attributable. The challenge is the inciting incident \u2014 the thing that pulled the rest of the story into motion.",
        "instructions": "Identify the issue at hand",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "tension",
        "name": "Tension",
        "description": "Raise the stakes. What happens if the challenge isn't met? Quantify the cost, name the people affected, surface the trade-offs that make the choice hard. Tension is what makes the audience lean in.",
        "instructions": "Emphasize the stakes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "solution",
        "name": "Solution",
        "description": "Reveal the strategy or hero of the story. Lead with what changes for the audience or customer when the solution is in place. This is the turn from problem to promise.",
        "instructions": "Present the hero/strategy",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "implementation",
        "name": "Implementation",
        "description": "Describe the path to success. Phases, owners, milestones, key bets. Show the audience that the solution has weight behind it \u2014 not just intent.",
        "instructions": "Describe the path to success",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "recap",
        "name": "Recap",
        "description": "Bring the audience back to the surface with a clear summary of what was said and decided. Echo the language from the opening so the story feels closed.",
        "instructions": "Review key points and insights",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Reinforce the key message and the call to action. End on the line you most want repeated in tomorrow's hallway conversations.",
        "layoutHint": "title-left",
        "instructions": "Reinforce takeaways and call to action",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "rags-to-riches",
    "name": "Rags to Riches",
    "summary": "Underdog journey from initial failure to eventual success. Pulls on resilience, grit, and perseverance \u2014 useful for founder stories, brand stories, and any deck where the audience needs to feel the cost behind the win.",
    "audienceFit": [
      "general-audience",
      "customers",
      "press",
      "candidates"
    ],
    "durationRange": {
      "minMinutes": 5,
      "maxMinutes": 20
    },
    "tags": [
      "storytelling",
      "founder",
      "brand",
      "inspirational"
    ],
    "beats": [
      {
        "id": "origin",
        "name": "Origin",
        "description": "Start at the bottom. Describe the humble beginning, the constraint, the moment before anything had been built. Concrete details \u2014 a place, a year, a feeling \u2014 earn the audience's investment in what follows.",
        "instructions": "Humble beginning",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "inspiration",
        "name": "Inspiration",
        "description": "Show the moment the protagonist found their calling. A conversation, a customer, a problem they couldn't unsee. The inspiration is the engine that pushes the rest of the story uphill.",
        "instructions": "Discover true calling",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "opportunity",
        "name": "Opportunity",
        "description": "Reveal the chance the protagonist took. Why this and not something safer? Make the choice visible \u2014 opportunities only count when there was something else they passed up to grab them.",
        "instructions": "Spot golden chance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "adversity",
        "name": "Adversity",
        "description": "Walk through the hardest stretch. Concrete failures, near-misses, moments of doubt. Resist the temptation to skip past the pain \u2014 the audience trusts the win more when the loss was real.",
        "instructions": "Face hardest struggles",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "overcoming",
        "name": "Overcoming",
        "description": "Show how the obstacles got beaten. What changed, what was learned, what hard call was made. The transition from 'rags' to 'riches' should feel earned, not granted.",
        "instructions": "Surmount tough obstacles",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "impactful-change",
        "name": "Impactful Change",
        "description": "Describe the moment the world tipped. The customer who said yes, the product that broke through, the metric that turned. One concrete transformation lands harder than a montage.",
        "instructions": "Alter the status quo",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "lasting-legacy",
        "name": "Lasting Legacy",
        "description": "Close on what the journey means for those who come next. The lesson, the people changed, the work that endures. Leave the audience with a takeaway that outlives the story.",
        "layoutHint": "title-left",
        "instructions": "Create enduring effect",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "underdog-victory",
    "name": "Underdog Victory",
    "summary": "Story arc of someone or something overlooked who triumphs in the end. Useful for founder narratives, brand stories, and team-building decks where the lesson is about resilience and unexpected wins.",
    "audienceFit": [
      "general-audience",
      "internal-teams",
      "candidates"
    ],
    "durationRange": {
      "minMinutes": 5,
      "maxMinutes": 20
    },
    "tags": [
      "storytelling",
      "inspirational",
      "founder",
      "team"
    ],
    "beats": [
      {
        "id": "origin",
        "name": "Origin",
        "description": "Establish the opening scene: who the underdog is and the world that overlooked them. Specific details make the rest of the journey feel real.",
        "instructions": "Establish opening scene",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "struggles",
        "name": "Struggles",
        "description": "Highlight the early setbacks. What didn't work, who said no, where the path closed up. The audience needs to feel the doubt before they can feel the win.",
        "instructions": "Highlight initial setbacks",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "determination",
        "name": "Determination",
        "description": "Showcase the enduring passion that kept the underdog going. What they refused to give up on, and why. Determination, in this beat, is the only resource the underdog has.",
        "instructions": "Showcase enduring passion",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "crisis",
        "name": "Crisis",
        "description": "Identify the lowest point of the journey. The moment the dream nearly ended. Don't soften \u2014 the contrast with the triumph ahead depends on the depth of this slide.",
        "instructions": "Identify lowest point",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "resolve",
        "name": "Resolve",
        "description": "Articulate the choice the underdog made to keep going. The strong will, the small bet, the borrowed faith. Resolve is where the protagonist becomes someone the audience roots for.",
        "instructions": "Articulate strong will",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "breakthrough",
        "name": "Breakthrough",
        "description": "Show the reward of perseverance: the customer who said yes, the door that opened, the fortune that turned. The breakthrough should feel earned, not granted.",
        "instructions": "Reward of perseverance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "triumph",
        "name": "Triumph",
        "description": "Reveal the ultimate success. Concrete outcomes, named milestones. The triumph is the audience's emotional payoff \u2014 let it land.",
        "instructions": "Reveal ultimate success",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "legacy",
        "name": "Legacy",
        "description": "Share the lasting impact. What the underdog's victory makes possible for those who come after. The legacy beat is what turns a story into a lesson.",
        "layoutHint": "title-left",
        "instructions": "Share long-lasting impact",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "survival-story",
    "name": "Survival Story",
    "summary": "Narrative arc of overcoming adversity through determination: catastrophe, backstory, plan, danger, effort, struggle, pivot, breakthrough, legacy, takeaway. For brand stories, founder histories, and leadership talks where the lesson lives in the comeback.",
    "audienceFit": [
      "general-audience",
      "internal-teams",
      "press"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "storytelling",
      "inspirational",
      "founder",
      "comeback"
    ],
    "beats": [
      {
        "id": "catastrophe",
        "name": "Catastrophe",
        "description": "Open in the middle of the disaster. Specific moment, specific stakes, specific damage. Drop the audience into the worst point of the story before walking them back.",
        "instructions": "Present initial disaster",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "backstory",
        "name": "Backstory",
        "description": "Detail the events that led up to the catastrophe. Just enough for the audience to understand how the disaster could have happened. Avoid moralizing \u2014 the story does the work.",
        "instructions": "Detail past events",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "blueprint",
        "name": "Blueprint",
        "description": "Illustrate the recovery plan. Specific moves, specific bets, specific people. The audience should see the strategy as more than 'try hard.'",
        "instructions": "Illustrate recovery plans",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "danger",
        "name": "Danger",
        "description": "Highlight the emerging threats to the recovery plan. New risks, returning ones. Tension here makes the eventual triumph credible.",
        "instructions": "Highlight emerging threats",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "endeavor",
        "name": "Endeavor",
        "description": "Show the determined effort underway. The hours, the trade-offs, the discipline. The audience must feel the work, not just hear about it.",
        "instructions": "Show determination effort",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "struggles",
        "name": "Struggles",
        "description": "Showcase challenging moments along the way: the setbacks, the false starts, the hard calls. Honest setbacks make eventual success feel earned.",
        "instructions": "Showcase challenging encounters",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "pivot",
        "name": "Pivot",
        "description": "Highlight the strategic shift that changed the trajectory. What got reconsidered, what got dropped, what got doubled down on. The pivot is the moment the protagonist became something new.",
        "instructions": "Highlight strategy shift",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "breakthrough",
        "name": "Breakthrough",
        "description": "Emphasize the moment adversity finally broke. Concrete result, concrete date. Let the slide land \u2014 the audience came for this turn.",
        "instructions": "Emphasize overcoming adversity",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "legacy",
        "name": "Legacy",
        "description": "Discuss the enduring impact. What survival made possible afterward, who benefited, what was built on top. Survival stories are most powerful when they create more than they restore.",
        "instructions": "Discuss enduring impact",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "takeaway",
        "name": "Takeaway",
        "description": "Share the lesson the audience can carry away. One transferable insight, framed for their own challenges \u2014 not a general moral.",
        "layoutHint": "title-left",
        "instructions": "Share important lessons",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "educate",
    "name": "Educate",
    "summary": "Engaging-explainer arc inspired by Mary Roach: surprise the audience with a fact, walk them through evidence and anecdote, scrutinize the assumptions, then close on a memorable insight. For technical, scientific, or analytical talks that need to feel more like discovery than instruction.",
    "audienceFit": [
      "general-audience",
      "students",
      "practitioners"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "keynote",
      "education",
      "explainer",
      "science"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Introduce the topic in a way that respects the audience's time and curiosity. Frame why this question is worth asking, and signal the shape of the journey ahead without giving away the destination.",
        "instructions": "Introduce the topic",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "surprising-fact",
        "name": "Surprising Fact",
        "description": "Lead with a single curious fact that recasts how the audience thinks about the topic. The fact should be small, specific, and unforgettable \u2014 the cognitive door the rest of the talk walks through.",
        "instructions": "Share a curious fact",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "experiment",
        "name": "Experiment",
        "description": "Walk through a method, study, or thought experiment that probes the surprising fact. Show how knowledge here gets made \u2014 the audience should feel like they're shoulder-to-shoulder with the investigator.",
        "instructions": "Explain a tried method",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "amusing-anecdote",
        "name": "Amusing Anecdote",
        "description": "Drop in a story or moment from the field that brings the topic to human scale. Personality and humor here keep the audience leaning forward; technical depth without warmth loses the room.",
        "instructions": "Relay an interesting story",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "intriguing-information",
        "name": "Intriguing Information",
        "description": "Layer in the more complex data or detail. By this point the audience is invested enough to do real work alongside you. Visualize generously \u2014 make the numbers tangible.",
        "instructions": "Share complex data",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "skeptical-scrutiny",
        "name": "Skeptical Scrutiny",
        "description": "Question the easy interpretations. Challenge the audience's defaults and your own. Showing where the evidence is contested is what separates a teacher from a publicist.",
        "instructions": "Encourage questioning of accepted truths",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "extraordinary-explanation",
        "name": "Extraordinary Explanation",
        "description": "Present the most counterintuitive or beautiful explanation the topic offers. Take your time here \u2014 this is the payoff slide the audience came for.",
        "instructions": "Break down unusual research findings",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "unconventional-use",
        "name": "Unconventional Use",
        "description": "Show an unexpected application or implication of the idea. Surprise reinforces the lesson and gives the audience a story to retell tomorrow.",
        "instructions": "Expand on unique aspects",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "captivating-conclusion",
        "name": "Captivating Conclusion",
        "description": "Close with a thoughtful, slightly poetic wrap-up. Echo the surprising fact, name the lesson, and leave the audience with a new question instead of a tidy answer.",
        "layoutHint": "title-left",
        "instructions": "Provide a thoughtful wrap-up",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "persuade",
    "name": "Persuade",
    "summary": "Argument-driven keynote arc inspired by Ken Robinson: grip the audience, challenge the status quo, define the problem, anchor it in story and statistic, deliver a major revelation, propose change, and end on a question that stays with them.",
    "audienceFit": [
      "general-audience",
      "policymakers",
      "industry-peers"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 30
    },
    "tags": [
      "keynote",
      "persuasive",
      "advocacy",
      "talk"
    ],
    "beats": [
      {
        "id": "gripping-introduction",
        "name": "Gripping Introduction",
        "description": "Open with a moment, image, or claim the audience can't easily look away from. The first sixty seconds buy you the next twenty minutes \u2014 spend them on something specific and emotionally charged, not on housekeeping.",
        "instructions": "Draw in the audience with a compelling opener",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "challenge-status-quo",
        "name": "Challenge the Status Quo",
        "description": "Call out the system, norm, or assumption that needs examination. Be precise about what you're disagreeing with so the rest of the talk can be specific in response. Avoid strawmen \u2014 name the strongest version of the view you're contesting."
      },
      {
        "id": "present-problem",
        "name": "Present the Problem",
        "description": "Define the issue the audience needs to care about. Concrete, scoped, attributable. The clearer the problem, the more credible the eventual solution."
      },
      {
        "id": "personal-story",
        "name": "Personal Story",
        "description": "Anchor the issue in a specific person, place, or moment. Story is what gets the argument past the audience's defenses. Pick a story that personalizes the data without overstating it.",
        "instructions": "Share significant stories to illuminate the issue",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "statistic-shock",
        "name": "Statistic Shock",
        "description": "Drop in a single statistic that recasts the scale of the problem. One number, presented well, lands harder than a dashboard. Cite the source so the audience can repeat it with confidence.",
        "instructions": "Use impactful stats to highlight the gravity of the issue",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "historical-context",
        "name": "Historical Context",
        "description": "Show how the issue evolved. Why it has the shape it does today, what was tried, what was missed. Historical context turns 'this is broken' into 'this stayed broken for these reasons.'",
        "instructions": "Show the evolution or history of the issue",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "weave-narrative",
        "name": "Weave a Narrative",
        "description": "Connect the threads \u2014 story, statistic, history \u2014 into a single argument. The audience should feel the case clicking together. This is the slide where rhetoric becomes architecture."
      },
      {
        "id": "major-revelation",
        "name": "Major Revelation",
        "description": "Deliver the surprising or significant turn. The fact, finding, or reframing the rest of the talk has been earning. The revelation should redirect, not merely confirm.",
        "instructions": "Deliver a surprising or significant discovery",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "propose-solution",
        "name": "Propose Solution",
        "description": "Advocate for the change you want. Concrete enough to be acted on, broad enough to inspire. Pair the solution with the smallest credible first step.",
        "instructions": "Advocate for change or propose an actionable solution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "final-question",
        "name": "Final Question",
        "description": "Close on a question rather than a summary. The right closing question follows the audience out of the room and into their conversations afterward.",
        "layoutHint": "title-left",
        "instructions": "Finish with a thought-provoking question to stimulate audience thinking",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "reveal",
    "name": "Reveal",
    "summary": "Insight-driven keynote arc inspired by Amy Cuddy's 2012 talk on body language: connect through personal story, ground in research, illustrate with anecdote, summarize, break stereotypes, advise, demonstrate authenticity, close with impact. For talks that aim to change how the audience sees something they thought they understood.",
    "audienceFit": [
      "general-audience",
      "academics",
      "professionals"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 25
    },
    "tags": [
      "keynote",
      "research",
      "talk",
      "inspirational"
    ],
    "beats": [
      {
        "id": "personal-story",
        "name": "Personal Story",
        "description": "Open with a personal experience that establishes why the topic matters to you. Specificity earns intimacy; intimacy earns the audience's permission to be moved.",
        "instructions": "Share personal experiences to connect with the audience",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "research-exposition",
        "name": "Research Exposition",
        "description": "Lay out the scientific or empirical data that backs the premise. Be rigorous but not academic \u2014 the audience needs to understand the evidence well enough to defend it later.",
        "instructions": "Unravel scientific data backing the premise",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "real-life-anecdote",
        "name": "Real-Life Anecdote",
        "description": "Illustrate the research with a story from the field. Make the abstract finding feel like something that happens to people the audience could imagine being.",
        "instructions": "Illustrate with stories to make the point relatable",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "critical-insights",
        "name": "Critical Insights",
        "description": "Summarize the two or three findings the audience must walk away with. Distill them into language a non-specialist could repeat without distortion.",
        "instructions": "Summarize key points",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "break-stereotypes",
        "name": "Break Stereotypes",
        "description": "Question redundant norms or beliefs the research undermines. Be specific about what's being challenged so the audience knows what to update.",
        "instructions": "Question redundant norms and belief systems",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "empowering-advice",
        "name": "Empowering Advice",
        "description": "Translate the insights into a small, actionable practice. The advice should be doable today, not only next quarter \u2014 the goal is movement, not aspiration.",
        "instructions": "Motivational message to act upon",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "authenticity",
        "name": "Authenticity",
        "description": "Speak honestly about your own struggle with the topic. Vulnerability, used with restraint, is what turns research into a felt truth.",
        "instructions": "Honest and real communication to demonstrate authenticity",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "close-with-impact",
        "name": "Close With Impact",
        "description": "End on a motivational high \u2014 the line, image, or invitation you want to follow the audience out of the room. Close the talk where it began, transformed.",
        "layoutHint": "title-left",
        "instructions": "End on a motivational high",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "justice",
    "name": "Justice",
    "summary": "Advocacy arc inspired by the rhetorical structure of Martin Luther King Jr.'s 'I Have a Dream' speech: name the inequality, share the dream, build urgency, layer further visions, emphasize unity, call to action, and close on hope. For movement-building keynotes and mission-driven speeches.",
    "audienceFit": [
      "general-audience",
      "advocates",
      "policymakers",
      "community"
    ],
    "durationRange": {
      "minMinutes": 10,
      "maxMinutes": 30
    },
    "tags": [
      "inspirational",
      "advocacy",
      "movement",
      "keynote"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Set the stage with a moment that earns the audience's full attention. Speak in the moral register the rest of the talk will require. Avoid throat-clearing \u2014 open as if the speech were already underway.",
        "instructions": "Set the stage",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "give-context",
        "name": "Give Context",
        "description": "Place the issue in its historical and current context. What promises were made, what has and hasn't been kept. Context turns the speech from opinion into accountability.",
        "instructions": "Put in historical and current context",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "highlight-inequality",
        "name": "Highlight Inequality",
        "description": "Show specific, undeniable examples of the inequality at issue. Concrete moments and people, not abstractions. The audience should feel the gap between what is and what was promised.",
        "instructions": "Show examples of inequality",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "share-dream",
        "name": "Share the Dream",
        "description": "Describe the future you envision in vivid, specific detail. The dream must be both ambitious and recognizable \u2014 a world the audience can picture themselves living in.",
        "instructions": "Describe your vision",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "create-urgency",
        "name": "Create Urgency",
        "description": "Explain why the time for change is now. The cost of waiting, the moment that won't return. Urgency converts shared vision into shared movement.",
        "instructions": "Explain the need for immediate change",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "another-dream",
        "name": "Continue the Vision",
        "description": "Layer additional visions of the future in parallel structure. Repetition and rhythm build momentum the way a single image cannot.",
        "instructions": "Continue to elaborate on your vision",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "emphasize-unity",
        "name": "Emphasize Unity",
        "description": "Speak to the collective power of the audience together. Name common ground that crosses lines the issue normally divides. Unity is the engine that turns dream into march.",
        "instructions": "Talk about collective power",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "last-dream",
        "name": "Final Vision",
        "description": "Deliver one more, fully realized vision of the world you're calling for. Specific enough to be remembered, expansive enough to inspire.",
        "instructions": "Further share dreams of ideal in-depth",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "call-to-action",
        "name": "Call to Action",
        "description": "Ask the audience to participate in the change. Be specific about what 'doing something' looks like \u2014 show, march, give, vote, organize. Vague CTAs produce vague action.",
        "instructions": "Ask audience to participate in change",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "show-determination",
        "name": "Show Determination",
        "description": "Encourage persistence in the face of resistance. Acknowledge what will be hard. Determination, named honestly, is more durable than easy optimism.",
        "instructions": "Encourage persistence",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "create-hope",
        "name": "Create Hope",
        "description": "Close on hope grounded in evidence: progress already made, victories already won, ground already moved. Hope as a conclusion lands strongest when it sounds like it has been earned.",
        "layoutHint": "title-left",
        "instructions": "Inspire hope for future",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "innovation",
    "name": "Innovation",
    "summary": "Keynote-style product reveal inspired by Steve Jobs's 2007 iPhone launch: stage-set, reveal, demonstrate, wow, differentiate, reframe the category, build excitement, call to action, and thank the audience. For category-defining product moments.",
    "audienceFit": [
      "customers",
      "press",
      "developers",
      "general-audience"
    ],
    "durationRange": {
      "minMinutes": 20,
      "maxMinutes": 60
    },
    "tags": [
      "inspirational",
      "keynote",
      "launch",
      "product"
    ],
    "beats": [
      {
        "id": "opening",
        "name": "Opening",
        "description": "Set the stage. Tell the audience they're about to see something that matters, without yet showing it. The pause before the reveal is part of the reveal.",
        "layoutHint": "title-left",
        "instructions": "Set the stage",
        "slideType": "text"
      },
      {
        "id": "revelation",
        "name": "Revelation",
        "description": "Announce the product. One image, one name, one sentence. Anything more competes with the moment. The slide should feel like the curtain going up.",
        "instructions": "Announce product",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "demonstration",
        "name": "Demonstration",
        "description": "Show the product in real use. Choose a single defining workflow that captures what the product does and how it feels. Live beats canned wherever possible.",
        "instructions": "Showcase the product",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "wow-factor",
        "name": "Wow Factor",
        "description": "Highlight the cutting-edge feature that earns the headline. One thing, presented well \u2014 the audience should leave able to repeat it in a sentence.",
        "instructions": "Highlight cutting-edge features",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "differentiation",
        "name": "Differentiation",
        "description": "Make the contrast with existing alternatives unmistakable. Use comparisons that the audience already understands; don't argue against straw versions of the competition.",
        "instructions": "Distinctive factors",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "revolution",
        "name": "Revolution",
        "description": "Reframe the category. Show how the product changes what the playing field looks like, not just where you sit on it. This is the slide pundits will quote.",
        "instructions": "Change in the playing field",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "excitement",
        "name": "Excitement",
        "description": "Build anticipation around what's next: availability, partnerships, what the audience can imagine doing with the product. Excitement is how the room exits the keynote into the world.",
        "instructions": "Build anticipation",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "call-to-action",
        "name": "Call to Action",
        "description": "Give the audience the action that channels the excitement. Pre-order, try it, tell others. Be specific so the energy converts into behavior.",
        "instructions": "Urge to explore",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "gratitude",
        "name": "Gratitude",
        "description": "Thank the team that built it and the audience that came. Brief, sincere, not perfunctory. The closing thanks is the period at the end of the keynote.",
        "layoutHint": "title-left",
        "instructions": "Thank the audience",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "focus",
    "name": "Focus",
    "summary": "Long-term, principle-driven business arc inspired by Jeff Bezos's 1997 letter to shareholders: name the focus, account for performance, articulate the framework, and commit to the discipline that will keep the company on track. For founder letters, all-hands narratives, and any deck where the audience needs to feel the through-line.",
    "audienceFit": [
      "shareholders",
      "leadership",
      "all-hands",
      "board"
    ],
    "durationRange": {
      "minMinutes": 20,
      "maxMinutes": 45
    },
    "tags": [
      "inspirational",
      "leadership",
      "principles",
      "all-hands"
    ],
    "beats": [
      {
        "id": "welcome",
        "name": "Welcome",
        "description": "Open with a brief framing of what this update is for and what you intend to leave the audience with. Set the tone \u2014 long-term, candid, principle-driven.",
        "instructions": "Overview and objectives",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "accomplishments",
        "name": "Accomplishments",
        "description": "Showcase the period's most material wins, briefly. The audience came for what's next; wins earn permission for the harder slides ahead, but they aren't the headline.",
        "instructions": "Showcase recent achievements",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "potential",
        "name": "Potential",
        "description": "Detail the market and customer opportunities ahead. Size them honestly and connect them to the work already underway. Potential without specifics reads as wishful.",
        "instructions": "Detail market opportunities",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "competitive-edge",
        "name": "Competitive Edge",
        "description": "Reveal the strategic positioning that gives the business its advantage. Frame it as a structural moat, not a list of features. The audience should be able to repeat the moat in their own words.",
        "instructions": "Reveal strategic positioning",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "long-term-vision",
        "name": "Long-Term Vision",
        "description": "Emphasize the long-term view that anchors decisions. Quarters serve years; years serve decades. Anchor the audience in the time horizon you actually run the business on.",
        "instructions": "Emphasize focused future orientation",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "performance-metrics",
        "name": "Performance Metrics",
        "description": "Illuminate the indicators that show the long-term thesis is working. Choose metrics that compound \u2014 retention, NPS, unit economics \u2014 over those that flatter.",
        "instructions": "Illuminate growth indicators",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "growth-achievement",
        "name": "Growth Achievement",
        "description": "Certify the tangible progress against the long-term plan. Year-over-year, cohort behavior, expanded reach. Growth, in this beat, is evidence that the strategy is real.",
        "instructions": "Certify tangible progress",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "strategic-framework",
        "name": "Strategic Framework",
        "description": "Explain the principles that guide decisions. Customer obsession, long-term thinking, frugality, ownership \u2014 whatever the actual operating discipline is. Principles are the connective tissue between strategy and behavior.",
        "instructions": "Explain decision principles",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "expansion",
        "name": "Expansion",
        "description": "Detail the next areas of growth: products, segments, geographies. Tie each to the principles above so the audience sees expansion as continuity rather than scatter.",
        "instructions": "Detail growth potential",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "future-objectives",
        "name": "Future Objectives",
        "description": "Forecast the targets and commitments for the period ahead. Be specific enough to be held accountable. Vague objectives are how strategies erode.",
        "instructions": "Forecast upcoming targets",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "acknowledgment",
        "name": "Acknowledgment",
        "description": "Recognize the contributions of teams, customers, and partners that made the period possible. Specific names land harder than blanket thanks.",
        "instructions": "Recognize contributions and successes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing-remarks",
        "name": "Closing Remarks",
        "description": "Recap the focus, thank the audience, and inspire the work ahead. End with the line you most want quoted in tomorrow's newsletter.",
        "layoutHint": "title-left",
        "instructions": "Recap, thank, inspire",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "qbr",
    "name": "Quarterly Business Review",
    "summary": "Standard QBR / business-review arc for internal leadership reviews. Recap commitments, show what the numbers say, separate wins from challenges, lay out the plan, surface risks, and request the asks the team needs to execute.",
    "audienceFit": [
      "leadership",
      "executives",
      "cross-functional-partners"
    ],
    "durationRange": {
      "minMinutes": 30,
      "maxMinutes": 90
    },
    "tags": [
      "internal",
      "review",
      "operations",
      "reporting"
    ],
    "beats": [
      {
        "id": "objectives",
        "name": "Objectives",
        "description": "Open with what this review is for and what decisions you want out of it. Frame the scope and the hour ahead, so the audience knows what they're being asked to weigh in on.",
        "layoutHint": "title-center",
        "instructions": "Set the expectations",
        "slideType": "text"
      },
      {
        "id": "recap",
        "name": "Recap",
        "description": "Briefly remind the audience what the team committed to last quarter and the high-level results against those commitments. Keep it terse \u2014 this grounds the review in prior context, but the meat is ahead."
      },
      {
        "id": "performance-headline",
        "name": "Performance Headline",
        "description": "Show the top three to five KPIs with target vs actual and direction-of-travel. One slide that lets a busy executive grasp the quarter's outcome at a glance. Lead with the number, not the methodology."
      },
      {
        "id": "performance-detail",
        "name": "Performance Detail",
        "description": "Drill into the supporting metrics by area or function. One chart per metric; clear y-axis, clear unit, clear comparison period. Call out anomalies before someone else does."
      },
      {
        "id": "wins",
        "name": "Wins",
        "description": "Highlight the quarter's biggest wins and who drove them. Be specific \u2014 name the deal, the launch, the customer, the team. Recognition belongs in the deck, not just in the meeting."
      },
      {
        "id": "challenges",
        "name": "Challenges",
        "description": "Name the misses and headwinds honestly. What didn't work, what's still hard, what got harder. Pretending things are fine costs more credibility than acknowledging they aren't.",
        "instructions": "Address difficulties",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "insights",
        "name": "Insights",
        "description": "Translate the numbers into 'so what.' What did the data tell you about customers, the market, your operations, your bets? Insights should be opinions backed by evidence, not restatements of the metrics."
      },
      {
        "id": "priorities",
        "name": "Next-Quarter Priorities",
        "description": "Lay out the next quarter's top priorities. Each should trace clearly back to an insight or commitment. Three to five priorities, max \u2014 laundry lists are a tell that the team hasn't decided what matters most."
      },
      {
        "id": "sequencing",
        "name": "Sequencing",
        "description": "Show the order in which priorities ship and how they fit together. Dependencies, milestones, target dates. The audience should leave able to predict what comes when, not just what."
      },
      {
        "id": "risks",
        "name": "Risks",
        "description": "Name the risks to the plan honestly. Dependencies, assumptions, capacity gaps, market factors. For each risk, state the mitigation or the open question the audience can help resolve."
      },
      {
        "id": "asks",
        "name": "Asks",
        "description": "Specific, named requests of the audience. Decisions needed, resources required, escalations to unblock. End with clarity on what happens next and who owns it.",
        "layoutHint": "title-left"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "business-review",
    "name": "Business Review",
    "summary": "Full-loop review of recent activities to identify achievements, address challenges, and plan improvements. Goes deeper than a status update \u2014 closer to a customer-facing or partner-facing relationship review.",
    "audienceFit": [
      "customers",
      "partners",
      "stakeholders",
      "leadership"
    ],
    "durationRange": {
      "minMinutes": 30,
      "maxMinutes": 90
    },
    "tags": [
      "customer-relationship",
      "review",
      "operations"
    ],
    "beats": [
      {
        "id": "logo",
        "name": "Logo",
        "description": "Cover slide with logos and the review period. Establishes brand identity and signals the level of formality the rest of the deck will hold to.",
        "layoutHint": "title-left",
        "instructions": "Identity & representation",
        "slideType": "text"
      },
      {
        "id": "opening",
        "name": "Opening",
        "description": "Frame the meeting context and the goals for the next hour. What you'll cover, what decisions you want, what you don't intend to relitigate.",
        "instructions": "Meeting context & goals",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "review",
        "name": "Review",
        "description": "Outline the recent activities in scope: launches, projects, programs. Just enough scope-setting that the rest of the deck has shared vocabulary.",
        "instructions": "Outline recent activities",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "successes",
        "name": "Successes",
        "description": "Recognize the achievements in the review window. Lead with outcomes the audience cares about, not effort. Specific moves earn more credibility than aggregate progress.",
        "instructions": "Recognize achievements",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "challenges",
        "name": "Challenges",
        "description": "Address the problems faced honestly. What didn't work, what's still hard. Naming challenges in front of the audience earns more trust than letting them ask.",
        "instructions": "Address problems faced",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "solutions",
        "name": "Solutions",
        "description": "Discuss the fixes already implemented. Pair each with the result it produced, or, if it's still in flight, with the leading indicator you're watching.",
        "instructions": "Discuss implemented fixes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "outcome",
        "name": "Outcome",
        "description": "Display the results achieved across the review window. Let the data carry the slide; supporting commentary should explain context, not inflate the numbers.",
        "instructions": "Display results achieved",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "insights",
        "name": "Insights",
        "description": "Highlight the key learnings. What was confirmed, what surprised you, what the audience should take away. Insights are the slides people quote in follow-on meetings.",
        "instructions": "Highlight key learnings",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "future-strategy",
        "name": "Future Strategy",
        "description": "Define the next steps and the strategic direction that follows from the review. Specific enough to sequence; flexible enough to adapt.",
        "instructions": "Define next steps",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "feedback",
        "name": "Feedback",
        "description": "Capture audience thoughts. Two or three explicit prompts where you want input or alignment. The strength of a relationship review is in the conversation it provokes.",
        "instructions": "Capture audience thoughts",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "next-review",
        "name": "Next Review",
        "description": "Plan for follow-up: when the next review happens, what evidence you'll bring, what decisions are deferred until then. Continuity is the point of the cadence.",
        "instructions": "Plan for follow-up",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing",
        "name": "Closing",
        "description": "Recap and express optimism about the path forward. Close with the next concrete step and the people responsible for it.",
        "layoutHint": "title-left",
        "instructions": "Recap and express optimism",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "board-meeting",
    "name": "Board Meeting",
    "summary": "Comprehensive board update covering CEO commentary, key metrics, financials, functional updates, and forward-looking topics. Designed to keep directors informed, aligned, and ready to advise. Use the full set for in-person quarterly meetings; trim sections for monthly checkpoints.",
    "audienceFit": [
      "board",
      "directors",
      "executives",
      "investors"
    ],
    "durationRange": {
      "minMinutes": 60,
      "maxMinutes": 180
    },
    "tags": [
      "rhythm-of-business",
      "board",
      "governance",
      "executive"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Set the tone for the meeting and walk through the agenda in one slide. Signal which sections are for discussion versus information so directors know where their time is most valuable.",
        "layoutHint": "title-left",
        "instructions": "Set the tone",
        "slideType": "text"
      },
      {
        "id": "ceo-update",
        "name": "CEO Update",
        "description": "Deliver the CEO's view of the period: what changed, what mattered, where the company stands. Two or three sentences in the speaker's voice \u2014 board members read this slide first.",
        "instructions": "Deliver company insights",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "highlights",
        "name": "Highlights",
        "description": "Share major successes across the business. Customer wins, launches, hires, milestones. Specific and brief; this is the slide that sets the tone, not the slide that proves the case.",
        "instructions": "Share major successes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "challenges",
        "name": "Challenges",
        "description": "Address the obstacles facing the business honestly. Boards earn their value when surfaced to real problems; under-disclosure here erodes trust faster than the problems themselves.",
        "instructions": "Address potential obstacles",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "company-needs",
        "name": "Company Needs",
        "description": "Identify where the business needs the board's help: introductions, decisions, advice. Specific asks turn the meeting from a report into a working session.",
        "instructions": "Identify support requirements",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "funnel-metrics",
        "name": "Funnel Metrics",
        "description": "Discuss the sales pipeline: leads, conversion, velocity, win rate. Use the metrics that match the company's current motion; resist the temptation to show the same chart you showed last quarter for continuity's sake.",
        "instructions": "Discuss sales progress",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "engagement-metrics",
        "name": "Engagement Metrics",
        "description": "Analyze customer interaction: usage, retention, NPS, expansion. Show whether the product is being loved or only being bought.",
        "instructions": "Analyze customer interaction",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "financial-metrics",
        "name": "Financial Metrics",
        "description": "Review fiscal health: revenue, gross margin, burn, runway, cash. One slide directors can scan in twenty seconds and trust the numbers on.",
        "instructions": "Review fiscal health",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "performance-vs-plan",
        "name": "Performance vs Plan",
        "description": "Compare actuals to plan across the metrics that matter most. Variance is the slide directors will probe; show your work, name the drivers, propose adjustments.",
        "instructions": "Compare objectives and actuals",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "org-chart",
        "name": "Org Chart",
        "description": "Present the team structure and any key changes since the last meeting. Directors track org evolution as a leading indicator; help them see hires, departures, and reshapes clearly.",
        "instructions": "Present team structure",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "product-roadmap",
        "name": "Product Roadmap",
        "description": "Highlight the product plan and what ships when. Pair each major bet with the customer or business outcome it serves.",
        "instructions": "Highlight future plans",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "quality",
        "name": "Quality",
        "description": "Showcase the product quality bar: reliability, defect rates, support outcomes. Directors take quality as a proxy for engineering culture; let the data speak.",
        "instructions": "Showcase product's standards",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "engineering-update",
        "name": "Engineering Update",
        "description": "Communicate technical progress, key bets, and platform investments. Translate engineering work into business consequences directors can evaluate.",
        "instructions": "Communicate technical progress",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "marketing-update",
        "name": "Marketing Update",
        "description": "Update on demand-gen, brand, and category-shaping efforts. Connect spend to pipeline and pipeline to revenue; avoid 'campaigns we ran' lists.",
        "instructions": "Update on promotional efforts",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "business-development-update",
        "name": "Business Development Update",
        "description": "Speak to growth initiatives: partnerships, channels, alliances. Each entry should have a stage, an owner, and a credible upside.",
        "instructions": "Speak on growth initiatives",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "operations-update",
        "name": "Operations Update",
        "description": "Discuss day-to-day operations: people ops, finance, legal, IT. Brief but explicit \u2014 directors notice when ops is missing.",
        "instructions": "Discuss day-to-day activities",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "special-topic-1",
        "name": "Special Topic 1",
        "description": "Discuss the period's first deep-dive topic. This is where the board does its highest-leverage work; pose the question, show the analysis, ask for their view.",
        "instructions": "Discuss selected subject",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "special-topic-2",
        "name": "Special Topic 2",
        "description": "Cover the second deep-dive topic, framed the same way. Two specials per meeting; more, and the meeting becomes a recital.",
        "instructions": "Touch on additional topic",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "feedback",
        "name": "Feedback",
        "description": "Elicit the board's perspective with concrete prompts. The strength of board governance is in its candor \u2014 invite it explicitly.",
        "instructions": "Elicit board's thoughts",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "formalities",
        "name": "Formalities",
        "description": "Conclude with the necessary governance items: votes, approvals, committee reports, document acknowledgments. Run them efficiently and document the outcomes.",
        "instructions": "Conclude with necessary formalities",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "closing-remarks",
        "name": "Closing Remarks",
        "description": "Close with concluding observations and the agenda for the next meeting. End on a forward-looking note; directors should leave knowing what to watch.",
        "layoutHint": "title-left",
        "instructions": "Concluding observations",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "weekly-progress",
    "name": "Weekly Progress",
    "summary": "Tight rhythm-of-business arc for weekly progress reports: objectives, achievements, progress, challenges, opportunities, recognition, plan, discussion, conclusion. Designed for fifteen-to-thirty-minute team check-ins, not deep dives.",
    "audienceFit": [
      "managers",
      "teams",
      "cross-functional-partners"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 30
    },
    "tags": [
      "rhythm-of-business",
      "weekly",
      "internal",
      "operations"
    ],
    "beats": [
      {
        "id": "opening",
        "name": "Opening",
        "description": "Open with the initiative name, the date, and the one-line headline for the week. Frame the meeting in fifteen seconds so the rest of the time is content.",
        "layoutHint": "title-left",
        "instructions": "Initiative name & date",
        "slideType": "text"
      },
      {
        "id": "objectives",
        "name": "Objectives",
        "description": "State what the team set out to do this week. Specific, measurable. The audience should be able to read this slide alone and know what 'on track' would mean.",
        "instructions": "Set the expectations",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "achievements",
        "name": "Achievements",
        "description": "Celebrate the week's wins. Concrete, attributable, dated. Brevity here \u2014 the meeting is for what's next, not a victory lap.",
        "instructions": "Celebrate success",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "overall-progress",
        "name": "Overall Progress",
        "description": "Evaluate performance against the objectives. Use a simple status indicator (green/yellow/red) plus the leading metric. Help the audience scan the state in seconds.",
        "instructions": "Evaluate performance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "challenges",
        "name": "Challenges",
        "description": "Address what's hard right now: blockers, slipping items, surfaced risks. Tie each challenge to either an owner working it or a discussion you want this week.",
        "instructions": "Address difficulties",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "opportunities-for-improvement",
        "name": "Opportunities for Improvement",
        "description": "Surface where the team can level up. Process tweaks, tooling needs, ways of working. Improvement opportunities should feel like seeds, not corrections.",
        "instructions": "Seek growth",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "highlights-recognition",
        "name": "Highlights & Recognition",
        "description": "Recognize specific contributions by name. Recognition belongs in the deck, not just in the meeting \u2014 written acknowledgment travels further than verbal.",
        "instructions": "Appreciate efforts",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "goals-next-week",
        "name": "Goals Next Week",
        "description": "Plan the week ahead with three to five specific goals. Each should be small enough to finish, large enough to matter, and clearly owned.",
        "instructions": "Plan ahead",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "discussion-feedback",
        "name": "Discussion & Feedback",
        "description": "Open the floor with two or three prompts \u2014 decisions you need, opinions you want, blockers you'd like cleared. End the recap actively.",
        "instructions": "Encourage input",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Close with one line that motivates the team into the next week. Echo the headline so the meeting feels closed.",
        "layoutHint": "title-left",
        "instructions": "Recap & motivate",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "status-update",
    "name": "Status Update",
    "summary": "Concise progress-report arc for keeping a stakeholder informed: headline, brief, progress, results, plan, feedback. Optimized for short, repeated updates rather than one-time deep dives.",
    "audienceFit": [
      "stakeholders",
      "managers",
      "customers",
      "executives"
    ],
    "durationRange": {
      "minMinutes": 5,
      "maxMinutes": 15
    },
    "tags": [
      "reporting",
      "operations",
      "customer-relationship",
      "weekly"
    ],
    "beats": [
      {
        "id": "headline",
        "name": "Headline",
        "description": "Open with the single most important sentence the audience needs to know \u2014 on track, off track, or shifted. The headline replaces 'how's it going' with a clear answer.",
        "layoutHint": "title-left",
        "instructions": "Title & date",
        "slideType": "text"
      },
      {
        "id": "brief",
        "name": "Brief",
        "description": "State the objective for the period and what was promised. One slide, three lines. Frames the rest of the update so progress is read against a clear bar.",
        "instructions": "Summary/objectives",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "progress",
        "name": "Progress",
        "description": "Walk through the actions taken since the last update. Specific, attributable, dated. Avoid effort theater \u2014 list outcomes and material moves, not activity for its own sake.",
        "instructions": "Explain actions taken",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "results",
        "name": "Results",
        "description": "Show the outcomes those actions produced. Metrics, customer signals, decisions made. Keep the comparison crisp \u2014 versus plan, versus last period, versus benchmark.",
        "instructions": "Show outcomes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "action-plan",
        "name": "Action Plan",
        "description": "Outline the next steps and who owns them. Be specific about the next decision point and what would have to happen to slip the schedule.",
        "instructions": "Outline next steps",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "feedback",
        "name": "Feedback",
        "description": "Invite the audience to weigh in: where you'd like input, where you need a decision, where help would unblock you. End the update with an open hand, not a closed file.",
        "layoutHint": "title-left",
        "instructions": "Ask for response",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "performance-review",
    "name": "Performance Review",
    "summary": "Analytical review of individual, team, or company performance grounded in metrics. Walks through results, key drivers, wins, challenges, and the adjustments that will shape the next period.",
    "audienceFit": [
      "leadership",
      "managers",
      "teams"
    ],
    "durationRange": {
      "minMinutes": 20,
      "maxMinutes": 60
    },
    "tags": [
      "data-driven",
      "review",
      "operations",
      "metrics"
    ],
    "beats": [
      {
        "id": "briefing",
        "name": "Briefing",
        "description": "Frame what this review covers: the period, the unit, the standard you're measuring against. One slide that lets the audience know exactly what they're being asked to evaluate.",
        "layoutHint": "title-center",
        "instructions": "Outline presentation objective",
        "slideType": "text"
      },
      {
        "id": "results",
        "name": "Results",
        "description": "Lead with the headline result. On track, ahead, or behind, and by how much. Resist softening \u2014 clear numbers up front earn credibility for the analysis that follows.",
        "instructions": "Summarize performance findings",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "key-metrics",
        "name": "Key Metrics",
        "description": "Walk through the pivotal indicators. One chart per metric, clear comparison period, target or benchmark visible on the same frame. Help the audience see the data the way you do.",
        "instructions": "Review pivotal indicators",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "team-performance",
        "name": "Team Performance",
        "description": "Examine collective achievements and how the team contributed. Avoid generic praise; cite specific moves and the people behind them where the audience would expect it.",
        "instructions": "Examine collective achievements",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "highlight",
        "name": "Highlight",
        "description": "Spotlight one standout contribution that defined the period. A landmark deal, a launch, a fix, a hire. One vivid example sticks longer than a list of accomplishments.",
        "instructions": "Show key contribution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "analysis",
        "name": "Analysis",
        "description": "Dig under the metrics. What drove the numbers, what held them back, what's signal versus noise. Analysis is where the audience learns whether you actually understand the system you're reporting on.",
        "instructions": "Uncover data insights",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "success",
        "name": "Success",
        "description": "Reinforce the past triumphs that show the system works. Briefly \u2014 the audience came for what's next, not a victory lap. Wins earn permission for the harder slides ahead.",
        "instructions": "Reinforce past triumphs",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "challenges",
        "name": "Challenges",
        "description": "Name the obstacles encountered honestly. What didn't move, what regressed, what the team is still wrestling with. Understated challenges read as missed signal, not modesty.",
        "instructions": "Highlight encountered obstacles",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "adjustments",
        "name": "Adjustments",
        "description": "Identify the changes you're making in response. New tactics, reallocations, sunsets. Each adjustment should map to a challenge above \u2014 adjustments without diagnosis feel arbitrary.",
        "instructions": "Identify necessary changes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "strategy-evolution",
        "name": "Strategy Evolution",
        "description": "Show how the strategy itself evolves heading into the next period. Refinements, sharpened bets, dropped initiatives. The audience should see continuity as well as change.",
        "instructions": "Plan for improvement",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "discussion",
        "name": "Discussion",
        "description": "Open the floor with two or three specific prompts. End the review actively \u2014 questions you want answered, decisions you want made \u2014 so the meeting yields more than the deck.",
        "layoutHint": "title-left",
        "instructions": "Promote active discourse",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "survey-analysis",
    "name": "Survey Analysis",
    "summary": "Structured walk-through of survey results: topic, executive summary, methodology, findings, analysis, implications, recommendations. Built so a reader who only sees the second slide already knows the headline insight.",
    "audienceFit": [
      "executives",
      "researchers",
      "stakeholders",
      "marketing-teams"
    ],
    "durationRange": {
      "minMinutes": 20,
      "maxMinutes": 60
    },
    "tags": [
      "data-driven",
      "research",
      "insights",
      "voice-of-customer"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Open by naming the question the survey was meant to answer. Why this, why now, who commissioned it. Anchor the audience in the decision the survey is designed to inform.",
        "instructions": "Present survey topic",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "executive-summary",
        "name": "Executive Summary",
        "description": "State the top three findings in plain language on a single slide. A reader who only sees this slide should still be able to make the right call. Avoid hedging \u2014 synthesis is the point.",
        "instructions": "Summarize key findings",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "context",
        "name": "Context",
        "description": "Detail the situation behind the survey: prior knowledge, related research, the gap this work fills. Just enough to position the findings as new information rather than restated common sense.",
        "instructions": "Detail survey background",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "data-methodology",
        "name": "Data & Methodology",
        "description": "Describe how the data was collected and from whom. Sample size, recruitment, instrument, timing. Be honest about limitations; methodological transparency is what gives the findings their weight.",
        "instructions": "Discuss sourcing and collection",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "data-summary",
        "name": "Data Summary",
        "description": "Give the audience an overview of the dataset before drilling in. Demographics, response rates, distribution of key variables. Help them calibrate what 'most' and 'few' mean in this study.",
        "instructions": "Provide data overview",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "findings",
        "name": "Findings",
        "description": "Present the key insights one at a time. Lead each finding with the claim, then the chart. Avoid burying the point under the visualization \u2014 captions should restate the insight in words.",
        "instructions": "Highlight key insights",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "data-analysis",
        "name": "Data Analysis",
        "description": "Break down the data behind each finding: cross-tabs, segment splits, statistical confidence. This is the slide skeptics will scrutinize \u2014 make it scrutinizable.",
        "instructions": "Break down data",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "implications",
        "name": "Implications",
        "description": "Translate findings into 'so what.' What changes for product, marketing, ops, the customer? Implications without consequences are interesting trivia, not research.",
        "instructions": "Discuss survey implications",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "recommendations",
        "name": "Recommendations",
        "description": "Provide the actions that follow from the implications. Prioritize, attach owners, mark which require decisions. This is where research becomes useful.",
        "instructions": "Provide action plans",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Recap the headline finding and the most important recommendation. End with the next step \u2014 a follow-on study, a workshop, a decision \u2014 so the work doesn't sit on a shelf.",
        "layoutHint": "title-left",
        "instructions": "Recap and finalize",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "trend-analysis",
    "name": "Trend Analysis",
    "summary": "Identify and discuss data-driven patterns to understand performance and forecast what's next. Useful for market reviews, strategic outlooks, and any deck where the audience must act on a direction-of-travel call.",
    "audienceFit": [
      "executives",
      "analysts",
      "leadership"
    ],
    "durationRange": {
      "minMinutes": 15,
      "maxMinutes": 45
    },
    "tags": [
      "data-driven",
      "forecasting",
      "strategy",
      "analysis"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Open by establishing why this trend matters now. Tie it to a decision on the table or a forecast that's about to be made. Trends without consequences are filler.",
        "instructions": "Ignite interest, establish significance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "historical-comparison",
        "name": "Historical Comparison",
        "description": "Contrast current data with the relevant past. Pick the comparison window that makes the trend visible without cherry-picking. Be honest about base effects.",
        "instructions": "Contrast current and past data",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "pattern-identification",
        "name": "Pattern Identification",
        "description": "Name the recurring outcome you've spotted. Use one or two strong charts that show the pattern unambiguously. Avoid overclaiming significance from a small N.",
        "instructions": "Point out recurring outcomes",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "future-prediction",
        "name": "Future Prediction",
        "description": "Project where the trend leads if it continues. Show the forecast and the confidence interval. State the assumptions that would have to break for the prediction to fail.",
        "instructions": "Predict using established patterns",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "action-plan",
        "name": "Action Plan",
        "description": "Translate the prediction into the strategy it implies. Specific actions, sequenced. Each action should map to a particular reading of the trend, not a generic best practice.",
        "instructions": "Strategies based on prediction",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "implementation",
        "name": "Implementation",
        "description": "Walk through how the actions get executed: owners, milestones, monitoring. The audience should leave understanding what to do tomorrow, not just what to think about.",
        "instructions": "Discuss strategy execution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Recap the trend, the forecast, and the recommended action. End with the leading indicator you'll watch to know if the call is right.",
        "layoutHint": "title-left",
        "instructions": "Summarize key points",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "employee-review",
    "name": "Employee Review",
    "summary": "Constructive performance-review arc that recognizes work, gives candid feedback, and sets growth goals together. For one-on-one performance conversations and formal year-end reviews.",
    "audienceFit": [
      "employee",
      "manager",
      "hr-partner"
    ],
    "durationRange": {
      "minMinutes": 30,
      "maxMinutes": 60
    },
    "tags": [
      "workforce",
      "hr",
      "review",
      "manager"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Open with the period covered and the spirit of the conversation: collaborative, honest, growth-focused. Frame the meeting so both sides know what to expect.",
        "layoutHint": "title-left",
        "instructions": "Name & date",
        "slideType": "text"
      },
      {
        "id": "performance",
        "name": "Performance",
        "description": "Review job execution against the role's expectations. Specific examples, dated. Avoid characterizing the person; describe the work and its impact.",
        "instructions": "Review job execution",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "achievements",
        "name": "Achievements",
        "description": "Acknowledge what went well. Name the projects, the moves, the moments where the employee made a difference. Specific recognition lands harder than generic praise.",
        "instructions": "Acknowledge success",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "feedback",
        "name": "Feedback",
        "description": "Provide constructive feedback grounded in observation. Distinguish patterns from one-offs. Tell the employee something they can act on, not something they can only feel.",
        "instructions": "Provide positive remarks",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "constructive-criticism",
        "name": "Constructive Criticism",
        "description": "Suggest improvements in language that respects the employee's intelligence. Pair each piece of criticism with a concrete example and a specific behavior change you'd like to see.",
        "instructions": "Suggest improvements",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "development-opportunities",
        "name": "Development Opportunities",
        "description": "Highlight growth areas and the experiences that could stretch the employee. Frame development as an investment, not a fix.",
        "instructions": "Highlight growth areas",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "goals",
        "name": "Goals",
        "description": "Outline next-period goals together. Specific, measurable, with explicit support. The strongest goals are co-authored, not handed down.",
        "instructions": "Outline next steps",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "mentoring",
        "name": "Mentoring",
        "description": "Encourage continued learning through mentorship, training, peer pairings. Close the review with the message that growth is a shared responsibility, not a one-way evaluation.",
        "layoutHint": "title-left",
        "instructions": "Encourage continuous learning",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "performance-improvement-plan",
    "name": "Performance Improvement Plan",
    "summary": "Structured PIP arc that helps a struggling employee see expectations clearly, understand the gap, and walk into a credible improvement path. Designed to be respectful, specific, and outcome-focused \u2014 not punitive.",
    "audienceFit": [
      "employee",
      "manager",
      "hr-partner"
    ],
    "durationRange": {
      "minMinutes": 30,
      "maxMinutes": 60
    },
    "tags": [
      "workforce",
      "hr",
      "performance",
      "manager"
    ],
    "beats": [
      {
        "id": "introduction",
        "name": "Introduction",
        "description": "Begin respectfully and set a constructive tone. Be clear about what this conversation is and isn't. The opening shouldn't catastrophize or sugarcoat \u2014 clarity is kinder than either.",
        "instructions": "Begin respectfully and positively",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "set-expectations",
        "name": "Set Expectations",
        "description": "Detail the level of performance expected in the role. Specific behaviors, deliverables, and standards. Expectations the employee can't quote back are expectations they can't meet.",
        "instructions": "Detail desired performance",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "identify-problems",
        "name": "Identify Problems",
        "description": "Name the gap between expected and observed performance. Use specific examples and dates rather than impressions. Avoid characterizing the person; focus on the work product and the impact.",
        "instructions": "Highlight struggles and weaknesses",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "possible-solutions",
        "name": "Possible Solutions",
        "description": "Suggest improvement strategies tailored to the gaps named above. Behavior changes, structural changes, support structures. Frame them as paths the employee can choose, not orders to follow.",
        "instructions": "Suggest improvement strategies",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "offer-resources",
        "name": "Offer Resources",
        "description": "Make explicit what tools, coaching, training, or peer support is available. Resources demonstrate that the organization is investing in the outcome, not setting the employee up to fail.",
        "instructions": "Propose help and tools",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "motivate-change",
        "name": "Motivate Change",
        "description": "Connect improvement to what the employee values: their growth, their team, their career. Inspire action without minimizing the seriousness of the situation.",
        "instructions": "Inspire improvement action",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "follow-up",
        "name": "Follow Up",
        "description": "Schedule the check-ins. Frequency, format, criteria for progress. Predictable follow-up turns a PIP from a threat into a plan.",
        "instructions": "Schedule progress check-ins",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Close with confidence in the path forward and a clear restatement of what success looks like. End the meeting having both raised the bar and reaffirmed the relationship.",
        "layoutHint": "title-left",
        "instructions": "Encourage and remind success",
        "slideType": "text"
      }
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-narrative/v1",
    "id": "capacity-planning",
    "name": "Capacity Planning",
    "summary": "Workforce and operational capacity-planning arc: kickoff, urgency, current state, projection, tactics, implementation, revision, conclusion. For decks where leadership must decide whether the organization has enough resources to meet upcoming demand.",
    "audienceFit": [
      "leadership",
      "operations",
      "hr-partners",
      "finance"
    ],
    "durationRange": {
      "minMinutes": 20,
      "maxMinutes": 45
    },
    "tags": [
      "workforce",
      "operations",
      "planning",
      "resource-management"
    ],
    "beats": [
      {
        "id": "kickoff",
        "name": "Kickoff",
        "description": "Introduce what the planning exercise covers and the decision you need from the audience. Frame the time horizon and the resources in scope so the rest of the deck stays bounded.",
        "layoutHint": "title-center",
        "instructions": "Introduce the topic",
        "slideType": "text"
      },
      {
        "id": "urgency",
        "name": "Urgency",
        "description": "Show why this is the right moment to plan capacity. Pipeline shifts, hiring freezes, operational stress signals. Urgency turns capacity from an annual ritual into a decision the audience leans into.",
        "instructions": "Show needs",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "situation",
        "name": "Situation",
        "description": "Highlight the current resource picture: people, tools, infrastructure, vendor capacity. Show utilization, not just headcount. The audience should know where slack and stress live today.",
        "instructions": "Highlight current resources",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "projection",
        "name": "Projection",
        "description": "Predict future demand under your base case and a sensitivity case. Tie demand to specific drivers \u2014 pipeline, launches, seasonality \u2014 so the audience can challenge the assumptions, not just the totals.",
        "instructions": "Predict future demands",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "tactics",
        "name": "Tactics",
        "description": "Suggest the strategies for closing any gap: hiring, automation, outsourcing, prioritization. Each tactic should map to a specific demand driver and a defensible cost.",
        "instructions": "Suggest coping strategies",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "implementation",
        "name": "Implementation",
        "description": "Discuss how the plan gets deployed. Sequencing, owners, dependencies, lead times. Capacity decisions slip the most when the rollout isn't planned with the same rigor as the sizing.",
        "instructions": "Discuss deployment plans",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "revision",
        "name": "Revision",
        "description": "Define the leading indicators that would trigger a re-plan, and the cadence of review. Capacity plans age fast; show the audience how the plan stays alive.",
        "instructions": "Evaluate and adjust",
        "slideType": "text",
        "layoutHint": "text-1x-left"
      },
      {
        "id": "conclusion",
        "name": "Conclusion",
        "description": "Wrap up with the specific recommendations and the decisions you need today. End with the next checkpoint and what evidence will be on the table at it.",
        "layoutHint": "title-left",
        "instructions": "Wrap-up & recommendations",
        "slideType": "text"
      }
    ]
  }
];
var socialPlatforms = [
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "linkedin",
    "name": "LinkedIn",
    "summary": "Professional social network for individuals and companies.",
    "description": "LinkedIn distinguishes between member profiles ('/in/<handle>') and company pages ('/company/<handle>'). Renderers should pick the appropriate URL pattern based on whether the parent is an Organization or a Speaker.",
    "baseUrl": "https://linkedin.com",
    "profileUrlPattern": "https://linkedin.com/in/{handle}",
    "companyUrlPattern": "https://linkedin.com/company/{handle}",
    "handlePrefix": "",
    "handleExample": "alice-chen",
    "brandColor": "#0A66C2",
    "tags": [
      "professional",
      "default"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "x",
    "name": "X",
    "summary": "Real-time microblog for news, opinions, and discussion. Formerly Twitter.",
    "description": "X uses a single profile URL pattern for both individuals and organizations. Handles are conventionally rendered with an '@' prefix.",
    "baseUrl": "https://x.com",
    "profileUrlPattern": "https://x.com/{handle}",
    "handlePrefix": "@",
    "handleExample": "@alicechen",
    "brandColor": "#000000",
    "tags": [
      "microblog",
      "news",
      "default"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "github",
    "name": "GitHub",
    "summary": "Code-hosting platform for developers and organizations.",
    "description": "GitHub uses the same URL pattern for users and organizations ('/<handle>'). Use the companyUrlPattern for organization references for symmetry with platforms that distinguish.",
    "baseUrl": "https://github.com",
    "profileUrlPattern": "https://github.com/{handle}",
    "companyUrlPattern": "https://github.com/{handle}",
    "handlePrefix": "",
    "handleExample": "alicechen",
    "brandColor": "#181717",
    "tags": [
      "developer",
      "code"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "youtube",
    "name": "YouTube",
    "summary": "Video-sharing platform with creator and brand channels.",
    "description": "YouTube channels are addressable via the '@<handle>' form. The handlePrefix is '@' but it is part of the URL itself.",
    "baseUrl": "https://youtube.com",
    "profileUrlPattern": "https://youtube.com/@{handle}",
    "handlePrefix": "@",
    "handleExample": "@acme",
    "brandColor": "#FF0000",
    "tags": [
      "video",
      "creator",
      "brand"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "instagram",
    "name": "Instagram",
    "summary": "Photo and short-form video network from Meta.",
    "baseUrl": "https://instagram.com",
    "profileUrlPattern": "https://instagram.com/{handle}",
    "handlePrefix": "@",
    "handleExample": "@acme",
    "brandColor": "#E4405F",
    "tags": [
      "photo",
      "video",
      "lifestyle"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "facebook",
    "name": "Facebook",
    "summary": "General-purpose social network from Meta.",
    "baseUrl": "https://facebook.com",
    "profileUrlPattern": "https://facebook.com/{handle}",
    "companyUrlPattern": "https://facebook.com/{handle}",
    "handlePrefix": "",
    "handleExample": "acme",
    "brandColor": "#1877F2",
    "tags": [
      "general",
      "brand"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "tiktok",
    "name": "TikTok",
    "summary": "Short-form video network with strong recommendation feed.",
    "description": "TikTok profiles are addressable as '@<handle>'. The handlePrefix is '@' and is included in the URL.",
    "baseUrl": "https://tiktok.com",
    "profileUrlPattern": "https://tiktok.com/@{handle}",
    "handlePrefix": "@",
    "handleExample": "@acme",
    "brandColor": "#010101",
    "tags": [
      "video",
      "short-form"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "threads",
    "name": "Threads",
    "summary": "Text-first social network from Meta, integrated with Instagram identity.",
    "baseUrl": "https://threads.net",
    "profileUrlPattern": "https://threads.net/@{handle}",
    "handlePrefix": "@",
    "handleExample": "@alicechen",
    "brandColor": "#000000",
    "tags": [
      "microblog",
      "text"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "mastodon",
    "name": "Mastodon",
    "summary": "Decentralized microblog network across federated instances.",
    "description": "Mastodon profiles are instance-scoped: the canonical URL form is '<instance>/@<handle>' (e.g. https://hachyderm.io/@acme). The catalog cannot fix a single base URL \u2014 store full URLs as values, or '@<handle>@<instance>' as the rendered handle. The profileUrlPattern below is illustrative and assumes mastodon.social as a fallback.",
    "baseUrl": "https://mastodon.social",
    "profileUrlPattern": "https://mastodon.social/@{handle}",
    "handlePrefix": "@",
    "handleExample": "@alice@hachyderm.io",
    "brandColor": "#6364FF",
    "tags": [
      "microblog",
      "decentralized",
      "fediverse"
    ]
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-social-platform/v1",
    "id": "bluesky",
    "name": "Bluesky",
    "summary": "Decentralized microblog network built on the AT Protocol.",
    "description": "Bluesky handles are domain-style ('alice.bsky.social'). Profile URLs use the form 'https://bsky.app/profile/<handle>'. Renderers should pass the handle through unchanged.",
    "baseUrl": "https://bsky.app",
    "profileUrlPattern": "https://bsky.app/profile/{handle}",
    "handlePrefix": "",
    "handleExample": "alice.bsky.social",
    "brandColor": "#1185FE",
    "tags": [
      "microblog",
      "decentralized",
      "atproto"
    ]
  }
];
var languages = [
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "afrikaans",
    "name": "Afrikaans",
    "code": "AFR",
    "bcp47": "af",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "albanian",
    "name": "Albanian",
    "code": "SQI",
    "bcp47": "sq",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "amharic",
    "name": "Amharic",
    "code": "AMH",
    "bcp47": "am",
    "fontScheme": "nyala",
    "googleFontScheme": "noto-sans-ethiopic"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "arabic",
    "name": "Arabic",
    "code": "ARA",
    "bcp47": "ar",
    "fontScheme": "arabic-typesetting",
    "googleFontScheme": "noto-sans-arabic"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "armenian",
    "name": "Armenian",
    "code": "HYE",
    "bcp47": "hy",
    "fontScheme": "sylfaen",
    "googleFontScheme": "noto-sans-armenian"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "aymara",
    "name": "Aymara",
    "code": "AYM",
    "bcp47": "ay",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "azerbaijani",
    "name": "Azerbaijani",
    "code": "AZE",
    "bcp47": "az",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "bengali",
    "name": "Bengali",
    "code": "BEN",
    "bcp47": "bn",
    "fontScheme": "shonar-bangla",
    "googleFontScheme": "noto-sans-bengali"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "berber-latin",
    "name": "Berber (Latin)",
    "code": "BER",
    "bcp47": "ber-Latn",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "bosnian-latin",
    "name": "Bosnian (Latin)",
    "code": "BOS",
    "bcp47": "bs-Latn",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "bulgarian",
    "name": "Bulgarian",
    "code": "BUL",
    "bcp47": "bg",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "catalan",
    "name": "Catalan",
    "code": "CAT",
    "bcp47": "ca",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "cebuano",
    "name": "Cebuano",
    "code": "CEB",
    "bcp47": "ceb",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "chinese-simplified",
    "name": "Chinese (Simplified)",
    "code": "ZHO",
    "bcp47": "zh-Hans",
    "fontScheme": "microsoft-yahei",
    "googleFontScheme": "noto-sans-sc"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "chinese-traditional",
    "name": "Chinese (Traditional)",
    "code": "ZHO",
    "bcp47": "zh-Hant",
    "fontScheme": "microsoft-jhenghei",
    "googleFontScheme": "noto-sans-tc"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "chittagonian",
    "name": "Chittagonian",
    "code": "CTG",
    "bcp47": "ctg",
    "fontScheme": "vrinda",
    "googleFontScheme": "noto-sans-bengali"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "croatian",
    "name": "Croatian",
    "code": "HRV",
    "bcp47": "hr",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "czech",
    "name": "Czech",
    "code": "CES",
    "bcp47": "cs",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "danish",
    "name": "Danish",
    "code": "DAN",
    "bcp47": "da",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "dutch",
    "name": "Dutch",
    "code": "NLD",
    "bcp47": "nl",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "english",
    "name": "English",
    "code": "ENG",
    "bcp47": "en",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "english-au",
    "name": "English (Australia)",
    "code": "ENG",
    "bcp47": "en-AU",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "english-ca",
    "name": "English (Canada)",
    "code": "ENG",
    "bcp47": "en-CA",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "english-gb",
    "name": "English (United Kingdom)",
    "code": "ENG",
    "bcp47": "en-GB",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "english-in",
    "name": "English (India)",
    "code": "ENG",
    "bcp47": "en-IN",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "english-us",
    "name": "English (United States)",
    "code": "ENG",
    "bcp47": "en-US",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "estonian",
    "name": "Estonian",
    "code": "EST",
    "bcp47": "et",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "filipino",
    "name": "Filipino",
    "code": "FIL",
    "bcp47": "fil",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "finnish",
    "name": "Finnish",
    "code": "FIN",
    "bcp47": "fi",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "french",
    "name": "French",
    "code": "FRA",
    "bcp47": "fr",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "fulfulde",
    "name": "Fulfulde",
    "code": "FUL",
    "bcp47": "ff",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "galician",
    "name": "Galician",
    "code": "GLG",
    "bcp47": "gl",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "georgian",
    "name": "Georgian",
    "code": "KAT",
    "bcp47": "ka",
    "fontScheme": "sylfaen",
    "googleFontScheme": "noto-sans-georgian"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "german",
    "name": "German",
    "code": "DEU",
    "bcp47": "de",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "greek",
    "name": "Greek",
    "code": "ELL",
    "bcp47": "el",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "gujarati",
    "name": "Gujarati",
    "code": "GUJ",
    "bcp47": "gu",
    "fontScheme": "shruti",
    "googleFontScheme": "noto-sans-gujarati"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "hausa",
    "name": "Hausa",
    "code": "HAU",
    "bcp47": "ha",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "hebrew",
    "name": "Hebrew",
    "code": "HEB",
    "bcp47": "he",
    "fontScheme": "david",
    "googleFontScheme": "noto-sans-hebrew"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "hindi",
    "name": "Hindi",
    "code": "HIN",
    "bcp47": "hi",
    "fontScheme": "mangal",
    "googleFontScheme": "noto-sans-devangari"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "hungarian",
    "name": "Hungarian",
    "code": "HUN",
    "bcp47": "hu",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "igbo",
    "name": "Igbo",
    "code": "IBO",
    "bcp47": "ig",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "indonesian",
    "name": "Indonesian",
    "code": "IND",
    "bcp47": "id",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "italian",
    "name": "Italian",
    "code": "ITA",
    "bcp47": "it",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "japanese",
    "name": "Japanese",
    "code": "JPN",
    "bcp47": "ja",
    "fontScheme": "meiryo",
    "googleFontScheme": "noto-sans-jp"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "kannada",
    "name": "Kannada",
    "code": "KAN",
    "bcp47": "kn",
    "fontScheme": "tunga",
    "googleFontScheme": "noto-sans-kannada"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "kazakh",
    "name": "Kazakh",
    "code": "KAZ",
    "bcp47": "kk",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "khmer",
    "name": "Khmer",
    "code": "KHM",
    "bcp47": "km",
    "fontScheme": "daunpenh",
    "googleFontScheme": "noto-sans-khmer"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "kinyarwanda",
    "name": "Kinyarwanda",
    "code": "KIN",
    "bcp47": "rw",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "korean",
    "name": "Korean",
    "code": "KOR",
    "bcp47": "ko",
    "fontScheme": "malgun-gothic",
    "googleFontScheme": "noto-sans-kr"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "kurmanji",
    "name": "Kurmanji",
    "code": "KMR",
    "bcp47": "kmr",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "latvian",
    "name": "Latvian",
    "code": "LAV",
    "bcp47": "lv",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "lithuanian",
    "name": "Lithuanian",
    "code": "LIT",
    "bcp47": "lt",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "macedonian",
    "name": "Macedonian",
    "code": "MKD",
    "bcp47": "mk",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "malagasy",
    "name": "Malagasy",
    "code": "MLG",
    "bcp47": "mg",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "malay",
    "name": "Malay",
    "code": "ZSM",
    "bcp47": "zsm",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "malayalam",
    "name": "Malayalam",
    "code": "MAL",
    "bcp47": "ml",
    "fontScheme": "kartika",
    "googleFontScheme": "noto-sans-malayalam"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "maori",
    "name": "M\u0101ori",
    "code": "MRI",
    "bcp47": "mi",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "marathi",
    "name": "Marathi",
    "code": "MAR",
    "bcp47": "mr",
    "fontScheme": "mangal",
    "googleFontScheme": "noto-sans-devangari"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "mongolian",
    "name": "Mongolian",
    "code": "MON",
    "bcp47": "mn",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans-mongolian"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "nepali",
    "name": "Nepali",
    "code": "NEP",
    "bcp47": "ne",
    "fontScheme": "mangal",
    "googleFontScheme": "noto-sans-devangari"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "norwegian",
    "name": "Norwegian",
    "code": "NOR",
    "bcp47": "no",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "odia",
    "name": "Odia",
    "code": "ORI",
    "bcp47": "or",
    "fontScheme": "kalinga",
    "googleFontScheme": "noto-sans-oriya"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "oromo",
    "name": "Oromo",
    "code": "ORM",
    "bcp47": "om",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "pashto",
    "name": "Pashto",
    "code": "PUS",
    "bcp47": "ps",
    "fontScheme": "arial",
    "googleFontScheme": "noto-sans-arabic"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "persian",
    "name": "Persian",
    "code": "FAS",
    "bcp47": "fa",
    "fontScheme": "arabic-typesetting",
    "googleFontScheme": "noto-naksh-arabic"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "polish",
    "name": "Polish",
    "code": "POL",
    "bcp47": "pl",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "portuguese",
    "name": "Portuguese",
    "code": "POR",
    "bcp47": "pt",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "punjabi-gurmukhi",
    "name": "Punjabi (Gurmukhi)",
    "code": "PAN",
    "bcp47": "pa-Guru",
    "fontScheme": "raavi",
    "googleFontScheme": "noto-sans-gurmukhi"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "punjabi-shahmukhi",
    "name": "Punjabi (Shahmukhi)",
    "code": "PAN",
    "bcp47": "pa-Arab",
    "fontScheme": "arial",
    "googleFontScheme": "noto-nastaliq-urdu"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "romanian",
    "name": "Romanian",
    "code": "RON",
    "bcp47": "ro",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "russian",
    "name": "Russian",
    "code": "RUS",
    "bcp47": "ru",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "serbian-cyrillic",
    "name": "Serbian (Cyrillic)",
    "code": "SRP",
    "bcp47": "sr-Cyrl",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "serbian-latin",
    "name": "Serbian (Latin)",
    "code": "SRP",
    "bcp47": "sr-Latn",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "shona",
    "name": "Shona",
    "code": "SNA",
    "bcp47": "sn",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "slovak",
    "name": "Slovak",
    "code": "SLK",
    "bcp47": "sk",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "slovenian",
    "name": "Slovenian",
    "code": "SLV",
    "bcp47": "sl",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "somali",
    "name": "Somali",
    "code": "SOM",
    "bcp47": "so",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "spanish",
    "name": "Spanish",
    "code": "SPA",
    "bcp47": "es",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "swahili",
    "name": "Swahili",
    "code": "SWA",
    "bcp47": "sw",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "swedish",
    "name": "Swedish",
    "code": "SWE",
    "bcp47": "sv",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "tagalog",
    "name": "Tagalog",
    "code": "TGL",
    "bcp47": "tl",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "tajik",
    "name": "Tajik",
    "code": "TGK",
    "bcp47": "tg",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "tamil",
    "name": "Tamil",
    "code": "TAM",
    "bcp47": "ta",
    "fontScheme": "latha",
    "googleFontScheme": "noto-sans-tamil"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "telugu",
    "name": "Telugu",
    "code": "TEL",
    "bcp47": "te",
    "fontScheme": "gautami",
    "googleFontScheme": "noto-sans-telugu"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "thai",
    "name": "Thai",
    "code": "THA",
    "bcp47": "th",
    "fontScheme": "angsana-new",
    "googleFontScheme": "noto-sans-thai"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "turkish",
    "name": "Turkish",
    "code": "TUR",
    "bcp47": "tr",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "ukrainian",
    "name": "Ukrainian",
    "code": "UKR",
    "bcp47": "uk",
    "fontScheme": "aptos",
    "googleFontScheme": "noto-sans"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "urdu",
    "name": "Urdu",
    "code": "URD",
    "bcp47": "ur",
    "fontScheme": "arabic-typesetting",
    "googleFontScheme": "noto-nastaliq-urdu"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "uzbek-latin",
    "name": "Uzbek (Latin)",
    "code": "UZB",
    "bcp47": "uz-Latn",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "vietnamese-quoc-ngu",
    "name": "Vietnamese (Qu\u1ED1c Ng\u1EEF)",
    "code": "VIE",
    "bcp47": "vi-Latn",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "xhosa",
    "name": "Xhosa",
    "code": "XHO",
    "bcp47": "xh",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "yoruba",
    "name": "Yoruba",
    "code": "YOR",
    "bcp47": "yo",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-language/v1",
    "id": "zulu",
    "name": "Zulu",
    "code": "ZUL",
    "bcp47": "zu",
    "fontScheme": "aptos",
    "googleFontScheme": "roboto"
  }
];
var colorSchemes = [
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "black-and-white",
    "name": "Black & White",
    "accent1": "#9E9E9E",
    "accent2": "#424242",
    "accent3": "#616161",
    "accent4": "#757575",
    "accent5": "#9E9E9E",
    "accent6": "#212121",
    "dark1": "#000000",
    "dark2": "#000000",
    "followedHyperlink": "#424242",
    "hyperlink": "#212121",
    "light1": "#FFFFFF",
    "light2": "#FFFFFF"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "bold-red",
    "name": "Bold Red",
    "accent1": "#A41410",
    "accent2": "#2693A1",
    "accent3": "#EFA517",
    "accent4": "#E86D1F",
    "accent5": "#324472",
    "accent6": "#EFECCA",
    "dark1": "#000000",
    "dark2": "#232323",
    "followedHyperlink": "#2693A1",
    "hyperlink": "#324472",
    "light1": "#FFFFFF",
    "light2": "#DCDCDC"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "boost",
    "name": "Boost",
    "accent1": "#FD3223",
    "accent2": "#0308DB",
    "accent3": "#4F4955",
    "accent4": "#A1DB30",
    "accent5": "#0682FE",
    "accent6": "#FC03BE",
    "dark1": "#000000",
    "dark2": "#2C2C2C",
    "followedHyperlink": "#CC00CC",
    "hyperlink": "#0066CC",
    "light1": "#FFFFFF",
    "light2": "#EFEFEF"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "burnt-orange",
    "name": "Burnt Orange",
    "accent1": "#F77F00",
    "accent2": "#D62828",
    "accent3": "#003049",
    "accent4": "#FCBF49",
    "accent5": "#EAE2B7",
    "accent6": "#BFBFBF",
    "dark1": "#000000",
    "dark2": "#341B00",
    "followedHyperlink": "#D62828",
    "hyperlink": "#003049",
    "light1": "#FFFFFF",
    "light2": "#FFFBF7"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "cool-horizon",
    "name": "Cool Horizon",
    "accent1": "#2874A6",
    "accent2": "#1B4F72",
    "accent3": "#5499C7",
    "accent4": "#7BDBB2",
    "accent5": "#3AC67A",
    "accent6": "#24A89E",
    "dark1": "#000000",
    "dark2": "#011842",
    "followedHyperlink": "#551A8B",
    "hyperlink": "#0000EE",
    "light1": "#FFFFFF",
    "light2": "#F0F0F0"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "corporate-blue",
    "name": "Corporate Blue",
    "accent1": "#015DFE",
    "accent2": "#0100A6",
    "accent3": "#02ACFF",
    "accent4": "#94A1B2",
    "accent5": "#E3ECF3",
    "accent6": "#5A82FC",
    "dark1": "#000000",
    "dark2": "#011842",
    "followedHyperlink": "#954F72",
    "hyperlink": "#0563C1",
    "light1": "#FFFFFF",
    "light2": "#F3F7FF"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "deep-purple",
    "name": "Deep Purple",
    "accent1": "#6A1B9A",
    "accent2": "#7B1FA2",
    "accent3": "#8E24AA",
    "accent4": "#9C27B0",
    "accent5": "#AB47BC",
    "accent6": "#4A148C",
    "dark1": "#000000",
    "dark2": "#2B0B3E",
    "followedHyperlink": "#6A1B9A",
    "hyperlink": "#4A148C",
    "light1": "#FFFFFF",
    "light2": "#F8F2FC"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "forest-green",
    "name": "Forest Green",
    "accent1": "#4A7C59",
    "accent2": "#68B0AB",
    "accent3": "#8FC0A9",
    "accent4": "#C8D5B9",
    "accent5": "#FAF3DD",
    "accent6": "#BFBFBF",
    "dark1": "#000000",
    "dark2": "#263F2E",
    "followedHyperlink": "#68B0AB",
    "hyperlink": "#4A7C59",
    "light1": "#FFFFFF",
    "light2": "#EEF5F0"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "golden-yellow",
    "name": "Golden Yellow",
    "accent1": "#FCC82B",
    "accent2": "#44ADAD",
    "accent3": "#3E506B",
    "accent4": "#E23A59",
    "accent5": "#0F5E8C",
    "accent6": "#EFECCA",
    "dark1": "#000000",
    "dark2": "#3D2E02",
    "followedHyperlink": "#44ADAD",
    "hyperlink": "#E23A59",
    "light1": "#FFFFFF",
    "light2": "#FEFCF0"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "luxury",
    "name": "Luxury",
    "accent1": "#997929",
    "accent2": "#C15937",
    "accent3": "#951233",
    "accent4": "#1D483F",
    "accent5": "#4B6977",
    "accent6": "#639391",
    "dark1": "#000000",
    "dark2": "#2C2C2C",
    "followedHyperlink": "#CC00CC",
    "hyperlink": "#0066CC",
    "light1": "#FFFFFF",
    "light2": "#EFEFEF"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "pastel-red",
    "name": "Pastel Red",
    "accent1": "#FE938C",
    "accent2": "#E6B89C",
    "accent3": "#EAD2AC",
    "accent4": "#9CAFB7",
    "accent5": "#4281A4",
    "accent6": "#BFBFBF",
    "dark1": "#000000",
    "dark2": "#0C6268",
    "followedHyperlink": "#E6B89C",
    "hyperlink": "#FE938C",
    "light1": "#FFFFFF",
    "light2": "#FFEFEE"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "slate-gray",
    "name": "Slate Gray",
    "accent1": "#9E9E9E",
    "accent2": "#424242",
    "accent3": "#616161",
    "accent4": "#757575",
    "accent5": "#9E9E9E",
    "accent6": "#212121",
    "dark1": "#000000",
    "dark2": "#1B1B1B",
    "followedHyperlink": "#424242",
    "hyperlink": "#212121",
    "light1": "#FFFFFF",
    "light2": "#F8F8F8"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "steel-blue",
    "name": "Steel Blue",
    "accent1": "#4A66AC",
    "accent2": "#629DD1",
    "accent3": "#297FD5",
    "accent4": "#7F8FA9",
    "accent5": "#5AA2AE",
    "accent6": "#9D90A0",
    "dark1": "#000000",
    "dark2": "#182238",
    "followedHyperlink": "#3EBBF0",
    "hyperlink": "#9454C3",
    "light1": "#FFFFFF",
    "light2": "#EAEDF6"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-color-scheme/v1",
    "id": "vibes",
    "name": "Vibes",
    "accent1": "#4A1BE4",
    "accent2": "#B8E109",
    "accent3": "#95928C",
    "accent4": "#E48A1B",
    "accent5": "#9E1BE4",
    "accent6": "#1BE4A1",
    "dark1": "#000000",
    "dark2": "#2C2C2C",
    "followedHyperlink": "#C30052",
    "hyperlink": "#0078D7",
    "light1": "#FFFFFF",
    "light2": "#EFEFEF"
  }
];
var fontSchemes = [
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "angsana-new",
    "name": "Angsana New",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Thai"
    ],
    "major": "Angsana New",
    "minor": "Angsana New",
    "textSample": "\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E2A\u0E27\u0E22\u0E21\u0E32\u0E01",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "aparajita",
    "name": "Aparajita",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Hindi",
      "Nepali"
    ],
    "major": "Aparajita",
    "minor": "Aparajita",
    "textSample": "\u092F\u0939 \u0938\u0941\u0902\u0926\u0930 \u0915\u093F\u0924\u093E\u092C",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "aptos",
    "name": "Aptos",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Aptos Display",
    "minor": "Aptos",
    "textSample": "Modern clean design",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "arabic-typesetting",
    "name": "Arabic Typesetting",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Arabic"
    ],
    "major": "Arabic Typesetting",
    "minor": "Arabic Typesetting",
    "textSample": "\u0647\u0630\u0627 \u0645\u0643\u062A\u0648\u0628 \u0628\u062E\u0637 \u0627\u0644\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "arial",
    "name": "Arial",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Arial Black",
    "minor": "Arial",
    "textSample": "Simple and clear",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "batang",
    "name": "Batang",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Korean"
    ],
    "major": "BatangChe",
    "minor": "Batang",
    "textSample": "\uC774\uAC83\uC740 \uBC14\uD0D5 \uD3F0\uD2B8\uB85C \uC4F0\uC5EC\uC84C\uC2B5\uB2C8\uB2E4",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "bookman",
    "name": "Bookman",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Bookman Old Style",
    "minor": "Bookman Old Style",
    "textSample": "Classic serif style",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "calibri",
    "name": "Calibri",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Calibri",
    "minor": "Calibri",
    "textSample": "Smooth professional look",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "century-schoolbook",
    "name": "Century Schoolbook",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Century Schoolbook",
    "minor": "Century Schoolbook",
    "textSample": "Traditional learning style",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "consolas",
    "name": "Consolas",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Consolas",
    "minor": "Consolas",
    "textSample": "Code block view",
    "type": "monospace"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "constantia",
    "name": "Constantia",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Constantia",
    "minor": "Constantia",
    "textSample": "Elegant modern serif",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "courier-new",
    "name": "Courier New",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Courier New",
    "minor": "Courier New",
    "textSample": "Typed letter look",
    "type": "monospace"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "daunpenh",
    "name": "DaunPenh",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Khmer"
    ],
    "major": "DaunPenh",
    "minor": "DaunPenh",
    "textSample": "\u1797\u17B6\u179F\u17B6\u1781\u17D2\u1798\u17C2\u179A\u1796\u17B7\u178F\u1787\u17B6\u179F\u17D2\u179A\u179F\u17CB\u179F\u17D2\u17A2\u17B6\u178F",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "david",
    "name": "David",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Hebrew"
    ],
    "major": "David",
    "minor": "David",
    "textSample": "\u05D6\u05D4 \u05DB\u05EA\u05D5\u05D1 \u05D1\u05D2\u05D5\u05E4\u05DF \u05D3\u05D5\u05D3",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "dilleniaupc",
    "name": "DilleniaUPC",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Thai"
    ],
    "major": "DilleniaUPC",
    "minor": "DilleniaUPC",
    "textSample": "\u0E23\u0E32\u0E15\u0E23\u0E35\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E34\u0E4C\u0E19\u0E30",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "fangsong",
    "name": "FangSong",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Chinese (simplified)"
    ],
    "major": "FangSong",
    "minor": "FangSong",
    "textSample": "\u8FD9\u662F\u7528\u4EFF\u5B8B\u5B57\u4F53\u5199\u7684",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "garamond",
    "name": "Garamond",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Garamond",
    "minor": "Garamond",
    "textSample": "Timeless book feel",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "gautami",
    "name": "Gautami",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Telugu"
    ],
    "major": "Gautami",
    "minor": "Gautami",
    "textSample": "\u0C07\u0C26\u0C3F \u0C17\u0C4C\u0C24\u0C2E\u0C3F \u0C2B\u0C3E\u0C02\u0C1F\u0C4D\u200C\u0C32\u0C4B \u0C35\u0C4D\u0C30\u0C3E\u0C2F\u0C2C\u0C21\u0C3F\u0C02\u0C26\u0C3F",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "georgia",
    "name": "Georgia",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Georgia",
    "minor": "Georgia",
    "textSample": "Warm digital serif",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "gisha",
    "name": "Gisha",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Hebrew",
      "Arabic"
    ],
    "major": "Gisha",
    "minor": "Gisha",
    "textSample": "\u05D6\u05D4 \u05E0\u05DB\u05EA\u05D1 \u05D1\u05D2\u05D5\u05E4\u05DF \u05D2\u05D9\u05E9\u05D4",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "grandview",
    "name": "Grandview",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Grandview Display",
    "minor": "Grandview",
    "textSample": "Bold road sign",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "gungsuh",
    "name": "Gungsuh",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Korean"
    ],
    "major": "GungsuhChe",
    "minor": "Gungsuh",
    "textSample": "\uC774\uAC83\uC740 \uAD81\uC11C \uD3F0\uD2B8\uB85C \uC4F0\uC5EC\uC84C\uC2B5\uB2C8\uB2E4",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "impact",
    "name": "Impact",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Impact",
    "minor": "Grandview",
    "textSample": "Strong bold headline",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "kalinga",
    "name": "Kalinga",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Odia"
    ],
    "major": "Kalinga",
    "minor": "Kalinga",
    "textSample": "\u0B0F\u0B39\u0B3E \u0B15\u0B33\u0B3F\u0B19\u0B4D\u0B17 \u0B2B\u0B23\u0B4D\u0B1F\u0B30\u0B47 \u0B32\u0B47\u0B16\u0B3E\u0B2F\u0B3E\u0B07\u0B1B\u0B3F",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "kartika",
    "name": "Kartika",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Malayalam"
    ],
    "major": "Kartika",
    "minor": "Kartika",
    "textSample": "\u0D07\u0D24\u0D4D \u0D15\u0D3E\u0D7C\u0D24\u0D4D\u0D24\u0D3F\u0D15 \u0D2B\u0D4B\u0D23\u0D4D\u0D1F\u0D3F\u0D7D \u0D0E\u0D34\u0D41\u0D24\u0D3F\u0D2F\u0D3F\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "khmer-ui",
    "name": "Khmer UI",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Khmer"
    ],
    "major": "Khmer UI",
    "minor": "Khmer UI",
    "textSample": "\u1797\u17B6\u179F\u17B6\u1781\u17D2\u1798\u17C2\u179A\u1796\u17B7\u178F\u1787\u17B6\u179F\u17D2\u179A\u179F\u17CB\u179F\u17D2\u17A2\u17B6\u178F",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "latha",
    "name": "Latha",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Tamil"
    ],
    "major": "Latha",
    "minor": "Latha",
    "textSample": "\u0B87\u0BA4\u0BC1 \u0BB2\u0BA4\u0BBE \u0B8E\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0BB0\u0BC1\u0BB5\u0BBF\u0BB2\u0BCD \u0B8E\u0BB4\u0BC1\u0BA4\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BC1\u0BB3\u0BCD\u0BB3\u0BA4\u0BC1",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "lucida-sans",
    "name": "Lucida Sans",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Lucida Sans",
    "minor": "Lucida Sans",
    "textSample": "Friendly clear text",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "malgun-gothic",
    "name": "Malgun Gothic",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Korean"
    ],
    "major": "Malgun Gothic",
    "minor": "Malgun Gothic",
    "textSample": "\uC774\uAC83\uC740 \uB9D1\uC740 \uACE0\uB515 \uD3F0\uD2B8\uB85C \uC4F0\uC5EC\uC84C\uC2B5\uB2C8\uB2E4",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "mangal",
    "name": "Mangal",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Hindi",
      "Sanskrit",
      "Marathi",
      "Nepali"
    ],
    "major": "Mangal",
    "minor": "Mangal",
    "textSample": "\u092F\u0939 \u092E\u0902\u0917\u0932 \u092B\u093C\u0949\u0928\u094D\u091F \u092E\u0947\u0902 \u0932\u093F\u0916\u093E \u0917\u092F\u093E \u0939\u0948",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "meiryo",
    "name": "Meiryo",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Japanese"
    ],
    "major": "Meiryo",
    "minor": "Meiryo",
    "textSample": "\u3053\u308C\u306F\u30E1\u30A4\u30EA\u30AA\u30D5\u30A9\u30F3\u30C8\u3067\u66F8\u304B\u308C\u3066\u3044\u307E\u3059",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "microsoft-jhenghei",
    "name": "Microsoft JhengHei",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Chinese (traditional)"
    ],
    "major": "Microsoft JhengHei",
    "minor": "Microsoft JhengHei",
    "textSample": "\u9019\u662F\u7528\u5FAE\u8EDF\u6B63\u9ED1\u9AD4\u5BEB\u7684",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "microsoft-yahei",
    "name": "Microsoft Yahei",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Chinese (simplified)",
      "Chinese (traditional)",
      "Japanese",
      "Korean"
    ],
    "major": "Microsoft YaHei",
    "minor": "Microsoft YaHei",
    "textSample": "\u8FD9\u662F\u7528\u5FAE\u8F6F\u96C5\u9ED1\u5B57\u4F53\u5199\u7684",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "mingliu",
    "name": "MingLiU",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Chinese (traditional)"
    ],
    "major": "MingLiU",
    "minor": "MingLiU",
    "textSample": "\u9019\u662F\u4EE5\u660E\u9AD4\u5B57\u578B\u64B0\u5BEB\u7684",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "miriam",
    "name": "Miriam",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Hebrew"
    ],
    "major": "Miriam",
    "minor": "Miriam",
    "textSample": "\u05D6\u05D4 \u05E0\u05DB\u05EA\u05D1 \u05D1\u05D2\u05D5\u05E4\u05DF \u05DE\u05E8\u05D9\u05DD",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "montserrat",
    "name": "Montserrat",
    "app": "Google Slides",
    "languageFamily": "latin",
    "languages": [],
    "major": "Montserrat",
    "minor": "Montserrat",
    "textSample": "This is beautiful",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "ms-mincho",
    "name": "MS Mincho",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Japanese"
    ],
    "major": "MS Mincho",
    "minor": "MS Mincho",
    "textSample": "\u3053\u308C\u306FMS\u660E\u671D\u30D5\u30A9\u30F3\u30C8\u3067\u66F8\u304B\u308C\u3066\u3044\u307E\u3059",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "nirmala-ui",
    "name": "Nirmala UI",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Hindi"
    ],
    "major": "Nirmala UI",
    "minor": "Nirmala UI",
    "textSample": "\u092F\u0939 \u0928\u093F\u0930\u094D\u092E\u0932\u093E \u092F\u0942\u0906\u0908 \u092B\u093C\u0949\u0928\u094D\u091F \u092E\u0947\u0902 \u0932\u093F\u0916\u093E \u0917\u092F\u093E \u0939\u0948",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-naksh-arabic",
    "name": "Noto Naskh Arabic",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Persian"
    ],
    "major": "Noto Naskh Arabic",
    "minor": "Noto Naskh Arabic",
    "textSample": "\u0647\u0630\u0627 \u0646\u0635 \u062C\u0645\u064A\u0644",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-nastaliq-urdu",
    "name": "Noto Nastaliq Urdu",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Urdu",
      "Punjabi (Shahmukhi)"
    ],
    "major": "Noto Nastaliq Urdu",
    "minor": "Noto Nastaliq Urdu",
    "textSample": "\u06CC\u06C1 \u062E\u0648\u0628\u0635\u0648\u0631\u062A \u06C1\u06D2",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans",
    "name": "Noto Sans",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Russian",
      "Ukrainian",
      "Serbian (Cyrillic)",
      "Tajik"
    ],
    "major": "Noto Sans",
    "minor": "Noto Sans",
    "textSample": "Universal and clear",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-arabic",
    "name": "Noto Sans Arabic",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Arabic",
      "Pashto",
      "Punjabi (Shahmukhi)"
    ],
    "major": "Noto Naskh Arabic",
    "minor": "Noto Naskh Arabic",
    "textSample": "\u0646\u0635 \u0639\u0631\u0628\u064A \u0623\u0646\u064A\u0642",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-armenian",
    "name": "Noto Sans Armenian",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Armenian"
    ],
    "major": "Noto Sans Armenian",
    "minor": "Noto Sans Armenian",
    "textSample": "\u054D\u0561 \u0570\u056B\u0561\u0576\u0561\u056C\u056B \u0567",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-bengali",
    "name": "Noto Sans Bengali",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Bengali",
      "Chittagonian"
    ],
    "major": "Noto Sans Bengali",
    "minor": "Noto Sans Bengali",
    "textSample": "\u098F\u099F\u09BE \u09B8\u09C1\u09A8\u09CD\u09A6\u09B0 \u09AC\u0987",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-devangari",
    "name": "Noto Sans Devanagari",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Hindi",
      "Nepali"
    ],
    "major": "Noto Sans Devanagari",
    "minor": "Noto Sans Devanagari",
    "textSample": "\u092F\u0939 \u092C\u0939\u0941\u0924 \u0905\u091A\u094D\u091B\u093E",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-ethiopic",
    "name": "Noto Sans Ethiopic",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Amharic"
    ],
    "major": "Noto Sans Ethiopic",
    "minor": "Noto Sans Ethiopic",
    "textSample": "\u12A0\u121B\u122D\u129B \u124B\u1295\u124B \u12A5\u1305\u130D \u1325\u1229 \u1290\u12CD\u1362",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-georgian",
    "name": "Noto Sans Georgian",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Georgian"
    ],
    "major": "Noto Sans Georgian",
    "minor": "Noto Sans Georgian",
    "textSample": "\u10D4\u10E1 \u10E3\u10DA\u10D0\u10DB\u10D0\u10D6\u10D4\u10E1\u10D8 \u10E1\u10D0\u10EE\u10DA\u10E8\u10D8",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-gujarati",
    "name": "Noto Sans Gujarati",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Gujarati"
    ],
    "major": "Noto Sans Gujarati",
    "minor": "Noto Sans Gujarati",
    "textSample": "\u0A86 \u0AB8\u0ABE\u0AB0\u0AC0 \u0AB8\u0ACD\u0AA5\u0ABF\u0AA4\u0ABF \u0A9B\u0AC7",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-gurmukhi",
    "name": "Noto Sans Gurmukhi",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Punjabi (Gurmukhi)"
    ],
    "major": "Noto Sans Gurmukhi",
    "minor": "Noto Sans Gurmukhi",
    "textSample": "\u0A07\u0A39 \u0A2C\u0A39\u0A41\u0A24 \u0A38\u0A4B\u0A39\u0A23\u0A3E \u0A39\u0A48",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-hebrew",
    "name": "Noto Sans Hebrew",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Hebrew"
    ],
    "major": "Noto Sans Hebrew",
    "minor": "Noto Sans Hebrew",
    "textSample": "\u05D6\u05D4 \u05E1\u05E4\u05E8 \u05D9\u05E4\u05D4\u05E4\u05D4",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-jp",
    "name": "Noto Sans JP",
    "app": "Google Slides",
    "languageFamily": "ea",
    "languages": [
      "Japanese"
    ],
    "major": "Noto Sans JP",
    "minor": "Noto Sans JP",
    "textSample": "\u3053\u308C\u306F\u7F8E\u3057\u3044\u3067\u3059",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-kannada",
    "name": "Noto Sans Kannada",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Kannada"
    ],
    "major": "Noto Sans Kannada",
    "minor": "Noto Sans Kannada",
    "textSample": "\u0C87\u0CA6\u0CC1 \u0CB8\u0CC1\u0C82\u0CA6\u0CB0 \u0CAA\u0CC1\u0CB8\u0CCD\u0CA4\u0C95",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-khmer",
    "name": "Noto Sans Khmer",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Khmer"
    ],
    "major": "Noto Sans Khmer",
    "minor": "Noto Sans Khmer",
    "textSample": "\u1797\u17B6\u179F\u17B6\u1781\u17D2\u1798\u17C2\u179A\u1796\u17B7\u178F\u1787\u17B6\u179F\u17D2\u179A\u179F\u17CB\u179F\u17D2\u17A2\u17B6\u178F",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-kr",
    "name": "Noto Sans KR",
    "app": "Google Slides",
    "languageFamily": "ea",
    "languages": [
      "Korean"
    ],
    "major": "Noto Sans KR",
    "minor": "Noto Sans KR",
    "textSample": "\uC774\uAC83\uC740 \uC544\uB984\uB2F5\uB2E4",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-malayalam",
    "name": "Noto Sans Malayalam",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Malayalam"
    ],
    "major": "Noto Sans Malayalam",
    "minor": "Noto Sans Malayalam",
    "textSample": "\u0D07\u0D24\u0D4D \u0D2E\u0D28\u0D4B\u0D39\u0D30\u0D2E\u0D3E\u0D23\u0D4D",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-mongolian",
    "name": "Noto Sans Mongolian",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Mongolian"
    ],
    "major": "Noto Sans Mongolian",
    "minor": "Noto Sans Mongolian",
    "textSample": "\u042D\u043D\u044D \u043C\u0430\u0448 \u0441\u0430\u0439\u0445\u0430\u043D",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-oriya",
    "name": "Noto Sans Oriya",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Odia"
    ],
    "major": "Noto Sans Oriya",
    "minor": "Noto Sans Oriya",
    "textSample": "\u0B0F\u0B39\u0B3E \u0B2C\u0B39\u0B41\u0B24 \u0B38\u0B41\u0B28\u0B4D\u0B26\u0B30",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-sc",
    "name": "Noto Sans SC",
    "app": "Google Slides",
    "languageFamily": "ea",
    "languages": [
      "Chinese (simplified)",
      "Chinese (traditional)",
      "Japanese",
      "Korean"
    ],
    "major": "Noto Sans SC",
    "minor": "Noto Sans SC",
    "textSample": "\u8FD9\u662F\u7F8E\u4E3D\u7684",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-tamil",
    "name": "Noto Sans Tamil",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Tamil"
    ],
    "major": "Noto Sans Tamil",
    "minor": "Noto Sans Tamil",
    "textSample": "\u0B87\u0BA4\u0BC1 \u0B85\u0BB4\u0B95\u0BBE\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-tc",
    "name": "Noto Sans TC",
    "app": "Google Slides",
    "languageFamily": "ea",
    "languages": [
      "Chinese (traditional)"
    ],
    "major": "Noto Sans TC",
    "minor": "Noto Sans TC",
    "textSample": "\u9019\u5F88\u7F8E\u9E97",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-telugu",
    "name": "Noto Sans Telugu",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Telugu"
    ],
    "major": "Noto Sans Telugu",
    "minor": "Noto Sans Telugu",
    "textSample": "\u0C07\u0C26\u0C3F \u0C1A\u0C15\u0C4D\u0C15\u0C28\u0C3F\u0C26\u0C3F",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "noto-sans-thai",
    "name": "Noto Sans Thai",
    "app": "Google Slides",
    "languageFamily": "cs",
    "languages": [
      "Thai"
    ],
    "major": "Noto Sans Thai",
    "minor": "Noto Sans Thai",
    "textSample": "\u0E19\u0E35\u0E48\u0E04\u0E37\u0E2D\u0E2A\u0E27\u0E22\u0E07\u0E32\u0E21",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "nyala",
    "name": "Nyala",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Amharic"
    ],
    "major": "Nyala",
    "minor": "Nyala",
    "textSample": "\u12A0\u121B\u122D\u129B \u124B\u1295\u124B \u12A5\u1305\u130D \u1325\u1229 \u1290\u12CD\u1362",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "open-sans",
    "name": "Open Sans",
    "app": "Google Slides",
    "languageFamily": "latin",
    "languages": [],
    "major": "Open Sans",
    "minor": "Open Sans",
    "textSample": "Modern and sleek",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "pmingliu",
    "name": "PMingLiU",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Chinese (traditional)"
    ],
    "major": "PMingLiU",
    "minor": "PMingLiU",
    "textSample": "\u9019\u662F\u4EE5\u65B0\u7D30\u660E\u9AD4\u5B57\u578B\u64B0\u5BEB\u7684",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "poppins",
    "name": "Poppins",
    "app": "Google Slides",
    "languageFamily": "latin",
    "languages": [],
    "major": "Poppins",
    "minor": "Poppins",
    "textSample": "Clean and readable",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "pt-serif",
    "name": "PT Serif",
    "app": "Google Slides",
    "languageFamily": "latin",
    "languages": [],
    "major": "PT Serif",
    "minor": "PT Serif",
    "textSample": "Elegant and timeless",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "raavi",
    "name": "Raavi",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Punjabi"
    ],
    "major": "Raavi",
    "minor": "Raavi",
    "textSample": "\u0A07\u0A39 \u0A30\u0A3E\u0A35\u0A40 \u0A2B\u0A4C\u0A02\u0A1F \u0A35\u0A3F\u0A71\u0A1A \u0A32\u0A3F\u0A16\u0A3F\u0A06 \u0A17\u0A3F\u0A06 \u0A39\u0A48",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "raleway",
    "name": "Raleway",
    "app": "Google Slides",
    "languageFamily": "latin",
    "languages": [],
    "major": "Raleway",
    "minor": "Raleway",
    "textSample": "Stylish and modern",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "roboto",
    "name": "Roboto",
    "app": "Google Slides",
    "languageFamily": "latin",
    "languages": [],
    "major": "Roboto",
    "minor": "Roboto",
    "textSample": "Perfect for tech",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "rockwell",
    "name": "Rockwell",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Rockwell",
    "minor": "Rockwell",
    "textSample": "Solid slab serif",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "sakkal-majalla",
    "name": "Sakkal Majalla",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Arabic",
      "Urdu",
      "Persian"
    ],
    "major": "Sakkal Majalla",
    "minor": "Sakkal Majalla",
    "textSample": "\u0647\u0630\u0627 \u0643\u062A\u0627\u0628 \u0631\u0627\u0626\u0639",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "seaford",
    "name": "Seaford",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Seaford Display",
    "minor": "Seaford",
    "textSample": "Humanist gentle tone",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "segoe-ui",
    "name": "Segoe UI",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Segoe UI Semibold",
    "minor": "Segoe UI",
    "textSample": "Modern interface font",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "segoe-ui-light",
    "name": "Segoe UI Light",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Segoe UI Semilight",
    "minor": "Segoe UI Light",
    "textSample": "Clean airy look",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "shonar-bangla",
    "name": "Shonar Bangla",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Bengali",
      "Chittagonian"
    ],
    "major": "Shonar Bangla",
    "minor": "Shonar Bangla",
    "textSample": "\u098F\u099F\u09BE \u0996\u09C1\u09AC \u09B8\u09C1\u09A8\u09CD\u09A6\u09B0",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "shruti",
    "name": "Shruti",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Gujarati"
    ],
    "major": "Shruti",
    "minor": "Shruti",
    "textSample": "\u0A86 \u0AB6\u0ACD\u0AB0\u0AC1\u0AA4\u0ABF \u0AAB\u0ACB\u0AA8\u0ACD\u0A9F\u0AAE\u0ABE\u0A82 \u0AB2\u0A96\u0ABE\u0AAF\u0AC1\u0A82 \u0A9B\u0AC7",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "simsun",
    "name": "SimSun",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Chinese (simplified)"
    ],
    "major": "SimSun",
    "minor": "SimSun",
    "textSample": "\u8FD9\u662F\u7528\u5B8B\u4F53\u5B57\u4F53\u5199\u7684",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "skeena",
    "name": "Skeena",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Skeena Display",
    "minor": "Skeena",
    "textSample": "Balanced contemporary style",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "sylfaen",
    "name": "Sylfaen",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Armenian",
      "Georgian"
    ],
    "major": "Sylfaen",
    "minor": "Sylfaen",
    "textSample": "\u10D4\u10E1 \u10E9\u10D4\u10DB\u10D8 \u10E1\u10D0\u10EE\u10DA\u10D8",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "tahoma",
    "name": "Tahoma",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Tahoma",
    "minor": "Tahoma",
    "textSample": "Clear screen text",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "tenorite",
    "name": "Tenorite",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Tenorite Display",
    "minor": "Tenorite",
    "textSample": "Rounded modern tone",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "times-new-roman",
    "name": "Times New Roman",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Times New Roman",
    "minor": "Times New Roman",
    "textSample": "Classic newspaper look",
    "type": "serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "traditional-arabic",
    "name": "Traditional Arabic",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Arabic",
      "Urdu",
      "Pashto"
    ],
    "major": "Traditional Arabic",
    "minor": "Traditional Arabic",
    "textSample": "\u0647\u0630\u0647 \u0645\u062F\u0631\u0633\u0629 \u062C\u0645\u064A\u0644\u0629",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "trebuchet-ms",
    "name": "Trebuchet MS",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Trebuchet MS",
    "minor": "Trebuchet MS",
    "textSample": "Casual web style",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "tunga",
    "name": "Tunga",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Kannada"
    ],
    "major": "Tunga",
    "minor": "Tunga",
    "textSample": "\u0C87\u0CA6\u0CC1 \u0CA4\u0CC1\u0C82\u0C97 \u0CAB\u0CBE\u0C82\u0C9F\u0CCD\u200C\u0CA8\u0CB2\u0CCD\u0CB2\u0CBF \u0CAC\u0CB0\u0CC6\u0CAF\u0CB2\u0CBE\u0C97\u0CBF\u0CA6\u0CC6",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "verdana",
    "name": "Verdana",
    "app": "PowerPoint",
    "languageFamily": "latin",
    "languages": [],
    "major": "Verdana",
    "minor": "Verdana",
    "textSample": "Wide readable font",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "vrinda",
    "name": "Vrinda",
    "app": "PowerPoint",
    "languageFamily": "cs",
    "languages": [
      "Bengali"
    ],
    "major": "Vrinda",
    "minor": "Vrinda",
    "textSample": "\u098F\u099F\u09BF \u09AD\u09CD\u09B0\u09BF\u09A8\u09CD\u09A6\u09BE \u09AB\u09A8\u09CD\u099F\u09C7 \u09B2\u09C7\u0996\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964",
    "type": "sans-serif"
  },
  {
    "$schema": "https://openpresentation.org/schema/opf-font-scheme/v1",
    "id": "yu-gothic",
    "name": "Yu Gothic",
    "app": "PowerPoint",
    "languageFamily": "ea",
    "languages": [
      "Japanese"
    ],
    "major": "Yu Gothic",
    "minor": "Yu Gothic",
    "textSample": "\u3053\u308C\u306F\u6E38\u30B4\u30B7\u30C3\u30AF\u30D5\u30A9\u30F3\u30C8\u3067\u66F8\u304B\u308C\u3066\u3044\u307E\u3059",
    "type": "sans-serif"
  }
];
var catalogs = {
  audiences,
  purposes,
  tones,
  themes,
  layouts,
  chartTypes,
  narratives,
  socialPlatforms,
  languages,
  colorSchemes,
  fontSchemes
};
var catalogIndexes = {
  audiences: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of presentation audiences available in the openpresentation.org catalog. Each entry is a lightweight summary; full audience records (seniority, technical fluency, decision power, attention budget, recommended narratives and tones) live in the per-id JSON files alongside this index. Audiences are referenced from OPF documents via audience.",
    "records": [
      {
        "id": "executives",
        "name": "Executives",
        "summary": "Senior leaders who need the recommendation up front, the evidence behind it, and the ask.",
        "file": "executives.json"
      },
      {
        "id": "board",
        "name": "Board of Directors",
        "summary": "Directors with fiduciary responsibility who balance oversight, advice, and approval.",
        "file": "board.json"
      },
      {
        "id": "engineering-team",
        "name": "Engineering Team",
        "summary": "Practitioners building the system; they want depth, mechanism, and tradeoffs.",
        "file": "engineering-team.json"
      },
      {
        "id": "investors",
        "name": "Investors",
        "summary": "Capital allocators evaluating fit, traction, and risk-adjusted return.",
        "file": "investors.json"
      },
      {
        "id": "customers",
        "name": "Customers",
        "summary": "Buyers and users \u2014 outcome-focused, allergic to jargon, sensitive to time.",
        "file": "customers.json"
      },
      {
        "id": "sales-team",
        "name": "Sales Team",
        "summary": "Quota-carrying reps who want talk tracks, objection handling, and crisp proof.",
        "file": "sales-team.json"
      },
      {
        "id": "marketing-team",
        "name": "Marketing Team",
        "summary": "Brand and demand-gen practitioners aligning on positioning, messaging, and campaigns.",
        "file": "marketing-team.json"
      },
      {
        "id": "all-hands",
        "name": "All Hands",
        "summary": "The full company \u2014 mixed roles, mixed seniority, looking for context, signal, and inclusion.",
        "file": "all-hands.json"
      },
      {
        "id": "candidates",
        "name": "Candidates",
        "summary": "Potential hires evaluating company, role, and people.",
        "file": "candidates.json"
      },
      {
        "id": "regulators",
        "name": "Regulators",
        "summary": "Government, agency, and policy reviewers evaluating compliance, risk, and impact.",
        "file": "regulators.json"
      }
    ]
  },
  purposes: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of presentation purposes available in the openpresentation.org catalog. Each entry is a lightweight summary; full purpose records live in the per-id JSON files alongside this index. Purposes are referenced from OPF documents via purpose.",
    "records": [
      {
        "id": "inform",
        "name": "Inform",
        "summary": "Give the audience clear context, facts, or status without asking for a decision.",
        "file": "inform.json"
      },
      {
        "id": "decide",
        "name": "Drive a Decision",
        "summary": "Frame options, evidence, tradeoffs, and a recommendation so the audience can choose.",
        "file": "decide.json"
      },
      {
        "id": "align",
        "name": "Align",
        "summary": "Create shared understanding and commitment across people who need to move together.",
        "file": "align.json"
      },
      {
        "id": "persuade",
        "name": "Persuade",
        "summary": "Change belief or win support for a specific argument, idea, or recommendation.",
        "file": "persuade.json"
      },
      {
        "id": "educate",
        "name": "Educate",
        "summary": "Teach a concept, process, product, or domain so the audience can use it correctly.",
        "file": "educate.json"
      },
      {
        "id": "report",
        "name": "Report",
        "summary": "Summarize performance, progress, or findings with enough context to interpret results.",
        "file": "report.json"
      },
      {
        "id": "pitch",
        "name": "Pitch",
        "summary": "Present an opportunity and ask for investment, approval, partnership, or sponsorship.",
        "file": "pitch.json"
      },
      {
        "id": "sell",
        "name": "Sell",
        "summary": "Move a buyer or evaluator toward purchase, adoption, renewal, or expansion.",
        "file": "sell.json"
      },
      {
        "id": "plan",
        "name": "Plan",
        "summary": "Establish a roadmap, operating plan, or sequence of actions with owners and next steps.",
        "file": "plan.json"
      }
    ]
  },
  tones: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of presentation tones available in the openpresentation.org catalog. Each entry is a lightweight summary; full tone records (voice cues, anti-patterns, sample phrases) live in the per-id JSON files alongside this index. Tones are referenced from OPF documents via tone.",
    "records": [
      {
        "id": "formal",
        "name": "Formal",
        "summary": "Polished, restrained voice for board, investor, and regulator audiences.",
        "file": "formal.json"
      },
      {
        "id": "casual",
        "name": "Casual",
        "summary": "Warm, plain-spoken voice for internal updates and customer storytelling.",
        "file": "casual.json"
      },
      {
        "id": "inspirational",
        "name": "Inspirational",
        "summary": "Aspirational, narrative-driven voice for keynotes, founders, and rallying cries.",
        "file": "inspirational.json"
      },
      {
        "id": "technical",
        "name": "Technical",
        "summary": "Precise, evidence-led voice for engineering, research, and product-detail audiences.",
        "file": "technical.json"
      },
      {
        "id": "persuasive",
        "name": "Persuasive",
        "summary": "Argument-led voice for sales, fundraising, and recommendation-driven decks.",
        "file": "persuasive.json"
      },
      {
        "id": "authoritative",
        "name": "Authoritative",
        "summary": "Expert, declarative voice for category-defining and analyst-style decks.",
        "file": "authoritative.json"
      },
      {
        "id": "conversational",
        "name": "Conversational",
        "summary": "Direct, dialog-style voice for podcasts, fireside chats, and small-group reviews.",
        "file": "conversational.json"
      }
    ]
  },
  themes: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of themes available in the openpresentation.org catalog. Each entry is a lightweight summary; full theme records live in the per-id JSON files alongside this index.",
    "records": [
      {
        "id": "bold",
        "name": "Bold",
        "description": "A vibrant, high-energy theme with bold colors and a dynamic, attention-grabbing style. Great for presentations that need to stand out.",
        "file": "bold.json"
      },
      {
        "id": "classic",
        "name": "Classic",
        "description": "A timeless, clean, and versatile theme with balanced color contrasts and classic typography. Ideal for professional, readable presentations.",
        "file": "classic.json"
      },
      {
        "id": "dark",
        "name": "Dark",
        "description": "A rich dark-mode theme with bold contrast and modern style. Great for moody, high-impact presentations.",
        "file": "dark.json"
      },
      {
        "id": "minimal",
        "name": "Minimal",
        "description": "A clean, minimalistic theme with a focus on simplicity and readability. Ideal for professional, straightforward presentations.",
        "file": "minimal.json"
      }
    ]
  },
  layouts: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of slide layouts available in the openpresentation.org catalog. Each entry is a lightweight summary; full layout records live in the per-id JSON files alongside this index.",
    "records": [
      {
        "id": "blank",
        "name": "Blank",
        "file": "blank.json"
      },
      {
        "id": "chart-1x",
        "name": "Chart 1x",
        "file": "chart-1x.json"
      },
      {
        "id": "chart-2x",
        "name": "Chart 2x",
        "file": "chart-2x.json"
      },
      {
        "id": "chart-3x",
        "name": "Chart 3x",
        "file": "chart-3x.json"
      },
      {
        "id": "code-1x",
        "name": "Code 1x",
        "file": "code-1x.json"
      },
      {
        "id": "image-1x",
        "name": "Image 1x",
        "file": "image-1x.json"
      },
      {
        "id": "image-2x",
        "name": "Image 2x",
        "file": "image-2x.json"
      },
      {
        "id": "image-3x",
        "name": "Image 3x",
        "file": "image-3x.json"
      },
      {
        "id": "image-bleed",
        "name": "Image Bleed",
        "file": "image-bleed.json"
      },
      {
        "id": "list-1x",
        "name": "List 1x",
        "file": "list-1x.json"
      },
      {
        "id": "list-2x",
        "name": "List 2x",
        "file": "list-2x.json"
      },
      {
        "id": "list-3x",
        "name": "List 3x",
        "file": "list-3x.json"
      },
      {
        "id": "list-4x",
        "name": "List 4x",
        "file": "list-4x.json"
      },
      {
        "id": "list-5x",
        "name": "List 5x",
        "file": "list-5x.json"
      },
      {
        "id": "list-6x",
        "name": "List 6x",
        "file": "list-6x.json"
      },
      {
        "id": "media-1x",
        "name": "Media 1x",
        "file": "media-1x.json"
      },
      {
        "id": "number-1x",
        "name": "Number 1x",
        "file": "number-1x.json"
      },
      {
        "id": "number-2x",
        "name": "Number 2x",
        "file": "number-2x.json"
      },
      {
        "id": "number-3x",
        "name": "Number 3x",
        "file": "number-3x.json"
      },
      {
        "id": "number-4x",
        "name": "Number 4x",
        "file": "number-4x.json"
      },
      {
        "id": "number-5x",
        "name": "Number 5x",
        "file": "number-5x.json"
      },
      {
        "id": "number-6x",
        "name": "Number 6x",
        "file": "number-6x.json"
      },
      {
        "id": "table-1x",
        "name": "Table 1x",
        "file": "table-1x.json"
      },
      {
        "id": "text-1x",
        "name": "Text 1x",
        "file": "text-1x.json"
      },
      {
        "id": "text-2x",
        "name": "Text 2x",
        "file": "text-2x.json"
      },
      {
        "id": "text-3x",
        "name": "Text 3x",
        "file": "text-3x.json"
      },
      {
        "id": "title",
        "name": "Title",
        "file": "title.json"
      },
      {
        "id": "title-subtitle",
        "name": "Title Subtitle",
        "file": "title-subtitle.json"
      }
    ]
  },
  chartTypes: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of chart types available in the pptx.gallery catalog. Each entry is a lightweight summary; full chart-type records live in the per-id JSON files alongside this index.",
    "records": [
      {
        "id": "100pct-bullet-bar",
        "name": "100PCT_BULLET_BAR",
        "label": "100% Bullet Bar",
        "group": "Bullet",
        "file": "100pct-bullet-bar.json"
      },
      {
        "id": "100pct-bullet-bar-2x",
        "name": "100PCT_BULLET_BAR_2X",
        "label": "100% Bullet Bar 2x",
        "group": "Bullet",
        "file": "100pct-bullet-bar-2x.json"
      },
      {
        "id": "100pct-bullet-bar-3x",
        "name": "100PCT_BULLET_BAR_3X",
        "label": "100% Bullet Bar 3x",
        "group": "Bullet",
        "file": "100pct-bullet-bar-3x.json"
      },
      {
        "id": "100pct-bullet-column",
        "name": "100PCT_BULLET_COLUMN",
        "label": "100% Bullet Column",
        "group": "Bullet",
        "file": "100pct-bullet-column.json"
      },
      {
        "id": "100pct-bullet-column-2x",
        "name": "100PCT_BULLET_COLUMN_2X",
        "label": "100% Bullet Colum 2x",
        "group": "Bullet",
        "file": "100pct-bullet-column-2x.json"
      },
      {
        "id": "100pct-bullet-column-3x",
        "name": "100PCT_BULLET_COLUMN_3X",
        "label": "100% Bullet Column 3x",
        "group": "Bullet",
        "file": "100pct-bullet-column-3x.json"
      },
      {
        "id": "100pct-progress-bar",
        "name": "100PCT_PROGRESS_BAR",
        "label": "100% Progress Bar",
        "group": "Bar",
        "file": "100pct-progress-bar.json"
      },
      {
        "id": "100pct-stacked-area-2x",
        "name": "100PCT_STACKED_AREA_2X",
        "label": "100% Stacked Area 2x",
        "group": "Area",
        "file": "100pct-stacked-area-2x.json"
      },
      {
        "id": "100pct-stacked-area-3x",
        "name": "100PCT_STACKED_AREA_3X",
        "label": "100% Stacked Area 3x",
        "group": "Area",
        "file": "100pct-stacked-area-3x.json"
      },
      {
        "id": "100pct-stacked-bar-2x",
        "name": "100PCT_STACKED_BAR_2X",
        "label": "100% Stacked Bar 2x",
        "group": "Bar",
        "file": "100pct-stacked-bar-2x.json"
      },
      {
        "id": "100pct-stacked-bar-3x",
        "name": "100PCT_STACKED_BAR_3X",
        "label": "100% Stacked Bar 3x",
        "group": "Bar",
        "file": "100pct-stacked-bar-3x.json"
      },
      {
        "id": "100pct-stacked-column-2x",
        "name": "100PCT_STACKED_COLUMN_2X",
        "label": "100% Stacked Column 2x",
        "group": "Column",
        "file": "100pct-stacked-column-2x.json"
      },
      {
        "id": "100pct-stacked-column-3x",
        "name": "100PCT_STACKED_COLUMN_3X",
        "label": "100% Stacked Column 3x",
        "group": "Column",
        "file": "100pct-stacked-column-3x.json"
      },
      {
        "id": "area",
        "name": "AREA",
        "label": "Area",
        "group": "Area",
        "file": "area.json"
      },
      {
        "id": "australia",
        "name": "AUSTRALIA",
        "label": "Australia",
        "group": "Map",
        "file": "australia.json"
      },
      {
        "id": "bar",
        "name": "BAR",
        "label": "Bar",
        "group": "Bar",
        "file": "bar.json"
      },
      {
        "id": "box-and-whisker",
        "name": "BOX_AND_WHISKER",
        "label": "Box & Whisker",
        "group": "Other",
        "file": "box-and-whisker.json"
      },
      {
        "id": "box-and-whisker-2x",
        "name": "BOX_AND_WHISKER_2X",
        "label": "Box & Whisker 2x",
        "group": "Other",
        "file": "box-and-whisker-2x.json"
      },
      {
        "id": "box-and-whisker-3x",
        "name": "BOX_AND_WHISKER_3X",
        "label": "Box & Whisker 3x",
        "group": "Other",
        "file": "box-and-whisker-3x.json"
      },
      {
        "id": "bullet-bar",
        "name": "BULLET_BAR",
        "label": "Bullet Bar",
        "group": "Bullet",
        "file": "bullet-bar.json"
      },
      {
        "id": "bullet-bar-2x",
        "name": "BULLET_BAR_2X",
        "label": "Bullet Bar 2x",
        "group": "Bullet",
        "file": "bullet-bar-2x.json"
      },
      {
        "id": "bullet-bar-3x",
        "name": "BULLET_BAR_3X",
        "label": "Bullet Bar 3x",
        "group": "Bullet",
        "file": "bullet-bar-3x.json"
      },
      {
        "id": "bullet-column",
        "name": "BULLET_COLUMN",
        "label": "Bullet Column",
        "group": "Bullet",
        "file": "bullet-column.json"
      },
      {
        "id": "bullet-column-2x",
        "name": "BULLET_COLUMN_2X",
        "label": "Bullet Column 2x",
        "group": "Bullet",
        "file": "bullet-column-2x.json"
      },
      {
        "id": "bullet-column-3x",
        "name": "BULLET_COLUMN_3X",
        "label": "Bullet Column 3x",
        "group": "Bullet",
        "file": "bullet-column-3x.json"
      },
      {
        "id": "canada",
        "name": "CANADA",
        "label": "Canada",
        "group": "Map",
        "file": "canada.json"
      },
      {
        "id": "clustered-bar-2x",
        "name": "CLUSTERED_BAR_2X",
        "label": "Clustered Bar 2x",
        "group": "Bar",
        "file": "clustered-bar-2x.json"
      },
      {
        "id": "clustered-column",
        "name": "CLUSTERED_COLUMN",
        "label": "Clustered Column",
        "group": "Column",
        "file": "clustered-column.json"
      },
      {
        "id": "column",
        "name": "COLUMN",
        "label": "Column",
        "group": "Column",
        "file": "column.json"
      },
      {
        "id": "dot-plot",
        "name": "DOT_PLOT",
        "label": "Dot Plot",
        "group": "XY (Scatter)",
        "file": "dot-plot.json"
      },
      {
        "id": "dot-plot-2x",
        "name": "DOT_PLOT_2X",
        "label": "Dot Plot 2x",
        "group": "XY (Scatter)",
        "file": "dot-plot-2x.json"
      },
      {
        "id": "dot-plot-3x",
        "name": "DOT_PLOT_3X",
        "label": "Dot Plot 3x",
        "group": "XY (Scatter)",
        "file": "dot-plot-3x.json"
      },
      {
        "id": "dot-plot-4x",
        "name": "DOT_PLOT_4X",
        "label": "Dot Plot 4x",
        "group": "XY (Scatter)",
        "file": "dot-plot-4x.json"
      },
      {
        "id": "dot-plot-5x",
        "name": "DOT_PLOT_5X",
        "label": "Dot Plot 5x",
        "group": "XY (Scatter)",
        "file": "dot-plot-5x.json"
      },
      {
        "id": "dot-plot-6x",
        "name": "DOT_PLOT_6X",
        "label": "Dot Plot 6x",
        "group": "XY (Scatter)",
        "file": "dot-plot-6x.json"
      },
      {
        "id": "doughnut",
        "name": "DOUGHNUT",
        "label": "Doughnut",
        "group": "Pie",
        "file": "doughnut.json"
      },
      {
        "id": "dumbbell",
        "name": "DUMBBELL",
        "label": "Dumbbell",
        "group": "Other",
        "file": "dumbbell.json"
      },
      {
        "id": "filled-radar",
        "name": "FILLED_RADAR",
        "label": "Filled Radar",
        "group": "Radar",
        "file": "filled-radar.json"
      },
      {
        "id": "funnel",
        "name": "FUNNEL",
        "label": "Funnel",
        "group": "Other",
        "file": "funnel.json"
      },
      {
        "id": "histogram",
        "name": "HISTOGRAM",
        "label": "Histogram",
        "group": "Histogram",
        "file": "histogram.json"
      },
      {
        "id": "line",
        "name": "LINE",
        "label": "Line",
        "group": "Line",
        "file": "line.json"
      },
      {
        "id": "line-2x",
        "name": "LINE_2X",
        "label": "Line 2x",
        "group": "Line",
        "file": "line-2x.json"
      },
      {
        "id": "line-3x",
        "name": "LINE_3X",
        "label": "Line 3x",
        "group": "Line",
        "file": "line-3x.json"
      },
      {
        "id": "line-with-high-low",
        "name": "LINE_WITH_HIGH_LOW",
        "label": "Line with High/Low",
        "group": "Line",
        "file": "line-with-high-low.json"
      },
      {
        "id": "line-with-high-low-and-markers",
        "name": "LINE_WITH_HIGH_LOW_AND_MARKERS",
        "label": "Line with High/Low and Markers",
        "group": "Line",
        "file": "line-with-high-low-and-markers.json"
      },
      {
        "id": "line-with-markers",
        "name": "LINE_WITH_MARKERS",
        "label": "Line with Markers",
        "group": "Line",
        "file": "line-with-markers.json"
      },
      {
        "id": "line-with-markers-2x",
        "name": "LINE_WITH_MARKERS_2X",
        "label": "Line with Markers 2x",
        "group": "Line",
        "file": "line-with-markers-2x.json"
      },
      {
        "id": "line-with-markers-3x",
        "name": "LINE_WITH_MARKERS_3X",
        "label": "Line with Markers 3x",
        "group": "Line",
        "file": "line-with-markers-3x.json"
      },
      {
        "id": "pareto",
        "name": "PARETO",
        "label": "Pareto",
        "group": "Histogram",
        "file": "pareto.json"
      },
      {
        "id": "pie",
        "name": "PIE",
        "label": "Pie",
        "group": "Pie",
        "file": "pie.json"
      },
      {
        "id": "radar",
        "name": "RADAR",
        "label": "Radar",
        "group": "Radar",
        "file": "radar.json"
      },
      {
        "id": "radar-with-markers",
        "name": "RADAR_WITH_MARKERS",
        "label": "Radar with Markers",
        "group": "Radar",
        "file": "radar-with-markers.json"
      },
      {
        "id": "scatter",
        "name": "SCATTER",
        "label": "Scatter",
        "group": "XY (Scatter)",
        "file": "scatter.json"
      },
      {
        "id": "sparkline",
        "name": "SPARKLINE",
        "label": "Sparkline",
        "group": "Sparkline",
        "file": "sparkline.json"
      },
      {
        "id": "sparkline-2x",
        "name": "SPARKLINE_2X",
        "label": "Sparkline 2x",
        "group": "Sparkline",
        "file": "sparkline-2x.json"
      },
      {
        "id": "sparkline-3x",
        "name": "SPARKLINE_3X",
        "label": "Sparkline 3x",
        "group": "Sparkline",
        "file": "sparkline-3x.json"
      },
      {
        "id": "sparkline-4x",
        "name": "SPARKLINE_4X",
        "label": "Sparkline 4x",
        "group": "Sparkline",
        "file": "sparkline-4x.json"
      },
      {
        "id": "sparkline-5x",
        "name": "SPARKLINE_5X",
        "label": "Sparkline 5x",
        "group": "Sparkline",
        "file": "sparkline-5x.json"
      },
      {
        "id": "sparkline-6x",
        "name": "SPARKLINE_6X",
        "label": "Sparkline 6x",
        "group": "Sparkline",
        "file": "sparkline-6x.json"
      },
      {
        "id": "stacked-area-2x",
        "name": "STACKED_AREA_2X",
        "label": "Stacked Area 2x",
        "group": "Area",
        "file": "stacked-area-2x.json"
      },
      {
        "id": "stacked-area-3x",
        "name": "STACKED_AREA_3X",
        "label": "Stacked Area 3x",
        "group": "Area",
        "file": "stacked-area-3x.json"
      },
      {
        "id": "stacked-bar-2x",
        "name": "STACKED_BAR_2X",
        "label": "Stacked Bar 2x",
        "group": "Bar",
        "file": "stacked-bar-2x.json"
      },
      {
        "id": "stacked-bar-3x",
        "name": "STACKED_BAR_3X",
        "label": "Stacked Bar 3x",
        "group": "Bar",
        "file": "stacked-bar-3x.json"
      },
      {
        "id": "stacked-column-2x",
        "name": "STACKED_COLUMN_2X",
        "label": "Stacked Column 2x",
        "group": "Column",
        "file": "stacked-column-2x.json"
      },
      {
        "id": "stacked-column-3x",
        "name": "STACKED_COLUMN_3X",
        "label": "Stacked Column 3x",
        "group": "Column",
        "file": "stacked-column-3x.json"
      },
      {
        "id": "stacked-line-2x",
        "name": "STACKED_LINE_2X",
        "label": "Stacked Line 2x",
        "group": "Line",
        "file": "stacked-line-2x.json"
      },
      {
        "id": "stacked-line-3x",
        "name": "STACKED_LINE_3X",
        "label": "Stacked Line 3x",
        "group": "Line",
        "file": "stacked-line-3x.json"
      },
      {
        "id": "stacked-line-with-markers-2x",
        "name": "STACKED_LINE_WITH_MARKERS_2X",
        "label": "Stacked Line with Markers 2x",
        "group": "Line",
        "file": "stacked-line-with-markers-2x.json"
      },
      {
        "id": "stacked-line-with-markers-3x",
        "name": "STACKED_LINE_WITH_MARKERS_3X",
        "label": "Stacked Line with Markers 3x",
        "group": "Line",
        "file": "stacked-line-with-markers-3x.json"
      },
      {
        "id": "treemap",
        "name": "TREEMAP",
        "label": "Treemap",
        "group": "Treemap",
        "file": "treemap.json"
      },
      {
        "id": "treemap-2x",
        "name": "TREEMAP_2X",
        "label": "Treemap 2x",
        "group": "Treemap",
        "file": "treemap-2x.json"
      },
      {
        "id": "treemap-3x",
        "name": "TREEMAP_3X",
        "label": "Treemap 3x",
        "group": "Treemap",
        "file": "treemap-3x.json"
      },
      {
        "id": "united-kingdom",
        "name": "UNITED_KINGDOM",
        "label": "United Kingdom",
        "group": "Map",
        "file": "united-kingdom.json"
      },
      {
        "id": "united-states",
        "name": "UNITED_STATES",
        "label": "United States",
        "group": "Map",
        "file": "united-states.json"
      },
      {
        "id": "waterfall",
        "name": "WATERFALL",
        "label": "Waterfall",
        "group": "Other",
        "file": "waterfall.json"
      },
      {
        "id": "world",
        "name": "WORLD",
        "label": "World",
        "group": "Map",
        "file": "world.json"
      }
    ]
  },
  narratives: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of narrative templates available in the openpresentation.org catalog. Each entry is a lightweight summary; full beat definitions live in the per-template JSON files alongside this index. Entries are grouped by usage: foundational arcs first, then pitches, sales and GTM, strategy and consulting, storytelling, keynotes and inspiration, rhythm-of-business reviews, data-driven analyses, and workforce reviews.",
    "records": [
      {
        "id": "problem-solution",
        "name": "Problem \u2192 Solution",
        "summary": "Classic business arc: name the pain, raise the stakes, present your fix, show how it works, prove it, ask.",
        "audienceFit": [
          "customers",
          "stakeholders",
          "executives",
          "internal-teams"
        ],
        "durationRange": {
          "minMinutes": 5,
          "maxMinutes": 30
        },
        "tags": [
          "business",
          "sales",
          "general",
          "proposal"
        ],
        "file": "problem-solution.json"
      },
      {
        "id": "scqa",
        "name": "SCQA (Situation\u2013Complication\u2013Question\u2013Answer)",
        "summary": "Minto's pyramid principle: surface the recommendation up front, then layer key arguments and supporting evidence beneath it.",
        "audienceFit": [
          "executives",
          "boards",
          "leadership-teams"
        ],
        "durationRange": {
          "minMinutes": 5,
          "maxMinutes": 20
        },
        "tags": [
          "executive",
          "strategy",
          "consulting",
          "minto",
          "pyramid"
        ],
        "file": "scqa.json"
      },
      {
        "id": "strategic-narrative",
        "name": "Strategic Narrative",
        "summary": "Change-driven sales/founder arc: a tectonic shift creates winners and losers, and your product is the way to land in the winners' camp.",
        "audienceFit": [
          "customers",
          "prospects",
          "board",
          "investors",
          "executives"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "strategic",
          "sales",
          "positioning",
          "category"
        ],
        "file": "strategic-narrative.json"
      },
      {
        "id": "golden-circle",
        "name": "Golden Circle (Why / How / What)",
        "summary": "Sinek's keynote arc: lead with belief, follow with method, finish with proof.",
        "audienceFit": [
          "customers",
          "employees",
          "general-audience",
          "press"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "keynote",
          "brand",
          "mission",
          "sinek"
        ],
        "file": "golden-circle.json"
      },
      {
        "id": "conference-talk",
        "name": "Conference Talk",
        "summary": "Stage-talk arc for industry events: hook, promise, evidence, mechanism, application, recap.",
        "audienceFit": [
          "practitioners",
          "general-audience",
          "industry-peers"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "talk",
          "conference",
          "keynote",
          "education"
        ],
        "file": "conference-talk.json"
      },
      {
        "id": "transformation-arc",
        "name": "Transformation Arc (Before / After / Bridge)",
        "summary": "Marketing-copy arc adapted for slides: paint the painful before, contrast the vivid after, deliver the bridge between them.",
        "audienceFit": [
          "customers",
          "prospects",
          "marketing-teams",
          "general-audience"
        ],
        "durationRange": {
          "minMinutes": 3,
          "maxMinutes": 15
        },
        "tags": [
          "marketing",
          "copywriting",
          "pitch",
          "persuasive"
        ],
        "file": "transformation-arc.json"
      },
      {
        "id": "pitch-deck",
        "name": "Startup Pitch Deck",
        "summary": "Canonical investor-pitch arc drawn from Sequoia and YC templates; optimized for 10\u201320 minute meetings.",
        "audienceFit": [
          "investors",
          "venture-capitalists",
          "angels",
          "advisors"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 20
        },
        "tags": [
          "startup",
          "fundraising",
          "pitch",
          "investor"
        ],
        "file": "pitch-deck.json"
      },
      {
        "id": "early-startup-pitch",
        "name": "Early-Stage Startup Pitch",
        "summary": "Seed and pre-seed pitch arc tuned for vision-heavy stories where revenue and traction are still thin.",
        "audienceFit": [
          "seed-investors",
          "angels",
          "advisors"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 20
        },
        "tags": [
          "startup",
          "fundraising",
          "seed",
          "pitch"
        ],
        "file": "early-startup-pitch.json"
      },
      {
        "id": "venture-pitch",
        "name": "Venture Pitch",
        "summary": "Series A/B fundraising arc structured around the canonical investor questions.",
        "audienceFit": [
          "investors",
          "venture-capitalists",
          "series-a",
          "series-b"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "startup",
          "fundraising",
          "pitch",
          "investor",
          "series-a"
        ],
        "file": "venture-pitch.json"
      },
      {
        "id": "persuasive-sales",
        "name": "Persuasive Sales",
        "summary": "Top-of-funnel sales arc anchored in market change, leading to your unique capabilities, supported by proof, ending with a clear ask.",
        "audienceFit": [
          "prospects",
          "customers",
          "buyers"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "sales",
          "go-to-market",
          "outbound",
          "discovery"
        ],
        "file": "persuasive-sales.json"
      },
      {
        "id": "company-intro",
        "name": "Company Intro",
        "summary": "Standard company-overview deck: who you are, what's distinctive, who you serve, why they win.",
        "audienceFit": [
          "prospects",
          "partners",
          "press",
          "candidates"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "overview",
          "go-to-market",
          "marketing",
          "intro"
        ],
        "file": "company-intro.json"
      },
      {
        "id": "marketing-strategy",
        "name": "Marketing Strategy",
        "summary": "Comprehensive go-to-market strategy arc structured around the 4Ps; for category launches and annual plans.",
        "audienceFit": [
          "marketing-leaders",
          "executives",
          "cross-functional-partners"
        ],
        "durationRange": {
          "minMinutes": 30,
          "maxMinutes": 60
        },
        "tags": [
          "go-to-market",
          "marketing",
          "strategy",
          "planning"
        ],
        "file": "marketing-strategy.json"
      },
      {
        "id": "product-launch",
        "name": "Product Launch",
        "summary": "Persuasive launch arc: brand, promise, conflict, stakes, reveal, raised stakes, sell, call to action.",
        "audienceFit": [
          "customers",
          "press",
          "general-audience",
          "partners"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "startup",
          "launch",
          "marketing",
          "keynote"
        ],
        "file": "product-launch.json"
      },
      {
        "id": "strategic-advisory",
        "name": "Strategic Advisory",
        "summary": "Consulting-style advisory deck applying Minto's pyramid: title, SCQ, answer, three argued points, summary.",
        "audienceFit": [
          "executives",
          "boards",
          "leadership-teams",
          "clients"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "consulting",
          "advisory",
          "strategy",
          "minto"
        ],
        "file": "strategic-advisory.json"
      },
      {
        "id": "challenge-resolution",
        "name": "Challenge \u2192 Resolution",
        "summary": "Identify a current business challenge, trace its origins, and recommend an actionable resolution.",
        "audienceFit": [
          "executives",
          "managers",
          "stakeholders",
          "internal-teams"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "management",
          "strategy",
          "consulting",
          "advisory"
        ],
        "file": "challenge-resolution.json"
      },
      {
        "id": "project-proposal",
        "name": "Project Proposal",
        "summary": "Internal proposal arc for greenlighting a project: hook, problem, idea, benefits, justification, plan, timeline, risks, outlook, ask.",
        "audienceFit": [
          "executives",
          "sponsors",
          "managers",
          "internal-teams"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "management",
          "proposal",
          "internal",
          "planning"
        ],
        "file": "project-proposal.json"
      },
      {
        "id": "failure-analysis",
        "name": "Failure Analysis",
        "summary": "Walk through what went wrong, why, and what changes \u2014 a structured post-mortem for stakeholder reviews.",
        "audienceFit": [
          "leadership",
          "customers",
          "stakeholders",
          "partners"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "postmortem",
          "incident",
          "review",
          "accountability"
        ],
        "file": "failure-analysis.json"
      },
      {
        "id": "classic-story",
        "name": "Classic Story",
        "summary": "Movie-style narrative arc applied to any topic: open the scene, introduce the villain, raise the stakes, send in the hero, deliver the plan, close with hope.",
        "audienceFit": [
          "general-audience",
          "customers",
          "internal-teams"
        ],
        "durationRange": {
          "minMinutes": 5,
          "maxMinutes": 30
        },
        "tags": [
          "storytelling",
          "general",
          "engagement"
        ],
        "file": "classic-story.json"
      },
      {
        "id": "business-narrative",
        "name": "Business Narrative",
        "summary": "Tell a business strategy or solution as a story: setting, challenge, tension, hero, plan, outcome.",
        "audienceFit": [
          "internal-teams",
          "leadership",
          "cross-functional-partners"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "management",
          "storytelling",
          "internal",
          "strategy"
        ],
        "file": "business-narrative.json"
      },
      {
        "id": "rags-to-riches",
        "name": "Rags to Riches",
        "summary": "Underdog journey from initial failure to eventual success \u2014 for founder stories and brand stories where the lesson is grit.",
        "audienceFit": [
          "general-audience",
          "customers",
          "press",
          "candidates"
        ],
        "durationRange": {
          "minMinutes": 5,
          "maxMinutes": 20
        },
        "tags": [
          "storytelling",
          "founder",
          "brand",
          "inspirational"
        ],
        "file": "rags-to-riches.json"
      },
      {
        "id": "underdog-victory",
        "name": "Underdog Victory",
        "summary": "Story arc of someone or something overlooked who triumphs in the end \u2014 for founder narratives and team-building decks.",
        "audienceFit": [
          "general-audience",
          "internal-teams",
          "candidates"
        ],
        "durationRange": {
          "minMinutes": 5,
          "maxMinutes": 20
        },
        "tags": [
          "storytelling",
          "inspirational",
          "founder",
          "team"
        ],
        "file": "underdog-victory.json"
      },
      {
        "id": "survival-story",
        "name": "Survival Story",
        "summary": "Narrative arc of overcoming adversity through determination \u2014 for brand stories and leadership talks where the lesson lives in the comeback.",
        "audienceFit": [
          "general-audience",
          "internal-teams",
          "press"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "storytelling",
          "inspirational",
          "founder",
          "comeback"
        ],
        "file": "survival-story.json"
      },
      {
        "id": "educate",
        "name": "Educate",
        "summary": "Engaging-explainer arc inspired by Mary Roach: surprise, evidence, anecdote, scrutiny, memorable insight.",
        "audienceFit": [
          "general-audience",
          "students",
          "practitioners"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "keynote",
          "education",
          "explainer",
          "science"
        ],
        "file": "educate.json"
      },
      {
        "id": "persuade",
        "name": "Persuade",
        "summary": "Argument-driven keynote arc inspired by Ken Robinson: grip, challenge, story, statistic, revelation, proposal, question.",
        "audienceFit": [
          "general-audience",
          "policymakers",
          "industry-peers"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 30
        },
        "tags": [
          "keynote",
          "persuasive",
          "advocacy",
          "talk"
        ],
        "file": "persuade.json"
      },
      {
        "id": "reveal",
        "name": "Reveal",
        "summary": "Insight-driven keynote arc inspired by Amy Cuddy: connect through story, ground in research, advise, demonstrate authenticity.",
        "audienceFit": [
          "general-audience",
          "academics",
          "professionals"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 25
        },
        "tags": [
          "keynote",
          "research",
          "talk",
          "inspirational"
        ],
        "file": "reveal.json"
      },
      {
        "id": "justice",
        "name": "Justice",
        "summary": "Advocacy arc inspired by 'I Have a Dream': inequality, dream, urgency, unity, call to action, hope.",
        "audienceFit": [
          "general-audience",
          "advocates",
          "policymakers",
          "community"
        ],
        "durationRange": {
          "minMinutes": 10,
          "maxMinutes": 30
        },
        "tags": [
          "inspirational",
          "advocacy",
          "movement",
          "keynote"
        ],
        "file": "justice.json"
      },
      {
        "id": "innovation",
        "name": "Innovation",
        "summary": "Keynote-style product reveal inspired by Steve Jobs's 2007 iPhone launch: stage, reveal, demonstrate, wow, differentiate, recategorize.",
        "audienceFit": [
          "customers",
          "press",
          "developers",
          "general-audience"
        ],
        "durationRange": {
          "minMinutes": 20,
          "maxMinutes": 60
        },
        "tags": [
          "inspirational",
          "keynote",
          "launch",
          "product"
        ],
        "file": "innovation.json"
      },
      {
        "id": "focus",
        "name": "Focus",
        "summary": "Long-term, principle-driven business arc inspired by Bezos's 1997 shareholder letter: focus, performance, framework, discipline.",
        "audienceFit": [
          "shareholders",
          "leadership",
          "all-hands",
          "board"
        ],
        "durationRange": {
          "minMinutes": 20,
          "maxMinutes": 45
        },
        "tags": [
          "inspirational",
          "leadership",
          "principles",
          "all-hands"
        ],
        "file": "focus.json"
      },
      {
        "id": "qbr",
        "name": "Quarterly Business Review",
        "summary": "Standard internal QBR arc: recap, performance, wins, challenges, insights, plan, risks, asks.",
        "audienceFit": [
          "leadership",
          "executives",
          "cross-functional-partners"
        ],
        "durationRange": {
          "minMinutes": 30,
          "maxMinutes": 90
        },
        "tags": [
          "internal",
          "review",
          "operations",
          "reporting"
        ],
        "file": "qbr.json"
      },
      {
        "id": "business-review",
        "name": "Business Review",
        "summary": "Full-loop review of recent activities \u2014 closer to a customer-facing or partner-facing relationship review than a status update.",
        "audienceFit": [
          "customers",
          "partners",
          "stakeholders",
          "leadership"
        ],
        "durationRange": {
          "minMinutes": 30,
          "maxMinutes": 90
        },
        "tags": [
          "customer-relationship",
          "review",
          "operations"
        ],
        "file": "business-review.json"
      },
      {
        "id": "board-meeting",
        "name": "Board Meeting",
        "summary": "Comprehensive board update covering CEO commentary, key metrics, financials, functional updates, and forward-looking topics.",
        "audienceFit": [
          "board",
          "directors",
          "executives",
          "investors"
        ],
        "durationRange": {
          "minMinutes": 60,
          "maxMinutes": 180
        },
        "tags": [
          "rhythm-of-business",
          "board",
          "governance",
          "executive"
        ],
        "file": "board-meeting.json"
      },
      {
        "id": "weekly-progress",
        "name": "Weekly Progress",
        "summary": "Tight rhythm-of-business arc for weekly progress reports \u2014 designed for fifteen-to-thirty-minute team check-ins.",
        "audienceFit": [
          "managers",
          "teams",
          "cross-functional-partners"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 30
        },
        "tags": [
          "rhythm-of-business",
          "weekly",
          "internal",
          "operations"
        ],
        "file": "weekly-progress.json"
      },
      {
        "id": "status-update",
        "name": "Status Update",
        "summary": "Concise progress-report arc for keeping a stakeholder informed: headline, brief, progress, results, plan, feedback.",
        "audienceFit": [
          "stakeholders",
          "managers",
          "customers",
          "executives"
        ],
        "durationRange": {
          "minMinutes": 5,
          "maxMinutes": 15
        },
        "tags": [
          "reporting",
          "operations",
          "customer-relationship",
          "weekly"
        ],
        "file": "status-update.json"
      },
      {
        "id": "performance-review",
        "name": "Performance Review",
        "summary": "Analytical review of individual, team, or company performance grounded in metrics and adjustments for the next period.",
        "audienceFit": [
          "leadership",
          "managers",
          "teams"
        ],
        "durationRange": {
          "minMinutes": 20,
          "maxMinutes": 60
        },
        "tags": [
          "data-driven",
          "review",
          "operations",
          "metrics"
        ],
        "file": "performance-review.json"
      },
      {
        "id": "survey-analysis",
        "name": "Survey Analysis",
        "summary": "Structured walk-through of survey results: topic, executive summary, methodology, findings, analysis, implications, recommendations.",
        "audienceFit": [
          "executives",
          "researchers",
          "stakeholders",
          "marketing-teams"
        ],
        "durationRange": {
          "minMinutes": 20,
          "maxMinutes": 60
        },
        "tags": [
          "data-driven",
          "research",
          "insights",
          "voice-of-customer"
        ],
        "file": "survey-analysis.json"
      },
      {
        "id": "trend-analysis",
        "name": "Trend Analysis",
        "summary": "Identify and discuss data-driven patterns to understand performance and forecast what's next.",
        "audienceFit": [
          "executives",
          "analysts",
          "leadership"
        ],
        "durationRange": {
          "minMinutes": 15,
          "maxMinutes": 45
        },
        "tags": [
          "data-driven",
          "forecasting",
          "strategy",
          "analysis"
        ],
        "file": "trend-analysis.json"
      },
      {
        "id": "employee-review",
        "name": "Employee Review",
        "summary": "Constructive performance-review arc that recognizes work, gives candid feedback, and sets growth goals together.",
        "audienceFit": [
          "employee",
          "manager",
          "hr-partner"
        ],
        "durationRange": {
          "minMinutes": 30,
          "maxMinutes": 60
        },
        "tags": [
          "workforce",
          "hr",
          "review",
          "manager"
        ],
        "file": "employee-review.json"
      },
      {
        "id": "performance-improvement-plan",
        "name": "Performance Improvement Plan",
        "summary": "Structured PIP arc that helps a struggling employee see expectations, understand the gap, and walk a credible improvement path.",
        "audienceFit": [
          "employee",
          "manager",
          "hr-partner"
        ],
        "durationRange": {
          "minMinutes": 30,
          "maxMinutes": 60
        },
        "tags": [
          "workforce",
          "hr",
          "performance",
          "manager"
        ],
        "file": "performance-improvement-plan.json"
      },
      {
        "id": "capacity-planning",
        "name": "Capacity Planning",
        "summary": "Workforce and operational capacity-planning arc: kickoff, urgency, current state, projection, tactics, implementation, revision.",
        "audienceFit": [
          "leadership",
          "operations",
          "hr-partners",
          "finance"
        ],
        "durationRange": {
          "minMinutes": 20,
          "maxMinutes": 45
        },
        "tags": [
          "workforce",
          "operations",
          "planning",
          "resource-management"
        ],
        "file": "capacity-planning.json"
      }
    ]
  },
  socialPlatforms: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of social-media platforms available in the openpresentation.org catalog. Each entry is a lightweight summary; full platform records live in the per-id JSON files alongside this index. The property keys of any Socials object on Organization or Speaker resolve to ids in this catalog.",
    "records": [
      {
        "id": "linkedin",
        "name": "LinkedIn",
        "summary": "Professional social network for individuals and companies.",
        "file": "linkedin.json"
      },
      {
        "id": "x",
        "name": "X",
        "summary": "Real-time microblog for news, opinions, and discussion. Formerly Twitter.",
        "file": "x.json"
      },
      {
        "id": "github",
        "name": "GitHub",
        "summary": "Code-hosting platform for developers and organizations.",
        "file": "github.json"
      },
      {
        "id": "youtube",
        "name": "YouTube",
        "summary": "Video-sharing platform with creator and brand channels.",
        "file": "youtube.json"
      },
      {
        "id": "instagram",
        "name": "Instagram",
        "summary": "Photo and short-form video network from Meta.",
        "file": "instagram.json"
      },
      {
        "id": "facebook",
        "name": "Facebook",
        "summary": "General-purpose social network from Meta.",
        "file": "facebook.json"
      },
      {
        "id": "tiktok",
        "name": "TikTok",
        "summary": "Short-form video network with strong recommendation feed.",
        "file": "tiktok.json"
      },
      {
        "id": "threads",
        "name": "Threads",
        "summary": "Text-first social network from Meta, integrated with Instagram identity.",
        "file": "threads.json"
      },
      {
        "id": "mastodon",
        "name": "Mastodon",
        "summary": "Decentralized microblog network across federated instances.",
        "file": "mastodon.json"
      },
      {
        "id": "bluesky",
        "name": "Bluesky",
        "summary": "Decentralized microblog network built on the AT Protocol.",
        "file": "bluesky.json"
      }
    ]
  },
  languages: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of languages available in the openpresentation.org catalog. Each entry is a lightweight summary with the canonical BCP-47 tag; full language records live in the per-id JSON files alongside this index.",
    "records": [
      {
        "id": "afrikaans",
        "name": "Afrikaans",
        "bcp47": "af",
        "file": "afrikaans.json"
      },
      {
        "id": "albanian",
        "name": "Albanian",
        "bcp47": "sq",
        "file": "albanian.json"
      },
      {
        "id": "amharic",
        "name": "Amharic",
        "bcp47": "am",
        "file": "amharic.json"
      },
      {
        "id": "arabic",
        "name": "Arabic",
        "bcp47": "ar",
        "file": "arabic.json"
      },
      {
        "id": "armenian",
        "name": "Armenian",
        "bcp47": "hy",
        "file": "armenian.json"
      },
      {
        "id": "aymara",
        "name": "Aymara",
        "bcp47": "ay",
        "file": "aymara.json"
      },
      {
        "id": "azerbaijani",
        "name": "Azerbaijani",
        "bcp47": "az",
        "file": "azerbaijani.json"
      },
      {
        "id": "bengali",
        "name": "Bengali",
        "bcp47": "bn",
        "file": "bengali.json"
      },
      {
        "id": "berber-latin",
        "name": "Berber (Latin)",
        "bcp47": "ber-Latn",
        "file": "berber-latin.json"
      },
      {
        "id": "bosnian-latin",
        "name": "Bosnian (Latin)",
        "bcp47": "bs-Latn",
        "file": "bosnian-latin.json"
      },
      {
        "id": "bulgarian",
        "name": "Bulgarian",
        "bcp47": "bg",
        "file": "bulgarian.json"
      },
      {
        "id": "catalan",
        "name": "Catalan",
        "bcp47": "ca",
        "file": "catalan.json"
      },
      {
        "id": "cebuano",
        "name": "Cebuano",
        "bcp47": "ceb",
        "file": "cebuano.json"
      },
      {
        "id": "chinese-simplified",
        "name": "Chinese (Simplified)",
        "bcp47": "zh-Hans",
        "file": "chinese-simplified.json"
      },
      {
        "id": "chinese-traditional",
        "name": "Chinese (Traditional)",
        "bcp47": "zh-Hant",
        "file": "chinese-traditional.json"
      },
      {
        "id": "chittagonian",
        "name": "Chittagonian",
        "bcp47": "ctg",
        "file": "chittagonian.json"
      },
      {
        "id": "croatian",
        "name": "Croatian",
        "bcp47": "hr",
        "file": "croatian.json"
      },
      {
        "id": "czech",
        "name": "Czech",
        "bcp47": "cs",
        "file": "czech.json"
      },
      {
        "id": "danish",
        "name": "Danish",
        "bcp47": "da",
        "file": "danish.json"
      },
      {
        "id": "dutch",
        "name": "Dutch",
        "bcp47": "nl",
        "file": "dutch.json"
      },
      {
        "id": "english",
        "name": "English",
        "bcp47": "en",
        "file": "english.json"
      },
      {
        "id": "english-au",
        "name": "English (Australia)",
        "bcp47": "en-AU",
        "file": "english-au.json"
      },
      {
        "id": "english-ca",
        "name": "English (Canada)",
        "bcp47": "en-CA",
        "file": "english-ca.json"
      },
      {
        "id": "english-gb",
        "name": "English (United Kingdom)",
        "bcp47": "en-GB",
        "file": "english-gb.json"
      },
      {
        "id": "english-in",
        "name": "English (India)",
        "bcp47": "en-IN",
        "file": "english-in.json"
      },
      {
        "id": "english-us",
        "name": "English (United States)",
        "bcp47": "en-US",
        "file": "english-us.json"
      },
      {
        "id": "estonian",
        "name": "Estonian",
        "bcp47": "et",
        "file": "estonian.json"
      },
      {
        "id": "filipino",
        "name": "Filipino",
        "bcp47": "fil",
        "file": "filipino.json"
      },
      {
        "id": "finnish",
        "name": "Finnish",
        "bcp47": "fi",
        "file": "finnish.json"
      },
      {
        "id": "french",
        "name": "French",
        "bcp47": "fr",
        "file": "french.json"
      },
      {
        "id": "fulfulde",
        "name": "Fulfulde",
        "bcp47": "ff",
        "file": "fulfulde.json"
      },
      {
        "id": "galician",
        "name": "Galician",
        "bcp47": "gl",
        "file": "galician.json"
      },
      {
        "id": "georgian",
        "name": "Georgian",
        "bcp47": "ka",
        "file": "georgian.json"
      },
      {
        "id": "german",
        "name": "German",
        "bcp47": "de",
        "file": "german.json"
      },
      {
        "id": "greek",
        "name": "Greek",
        "bcp47": "el",
        "file": "greek.json"
      },
      {
        "id": "gujarati",
        "name": "Gujarati",
        "bcp47": "gu",
        "file": "gujarati.json"
      },
      {
        "id": "hausa",
        "name": "Hausa",
        "bcp47": "ha",
        "file": "hausa.json"
      },
      {
        "id": "hebrew",
        "name": "Hebrew",
        "bcp47": "he",
        "file": "hebrew.json"
      },
      {
        "id": "hindi",
        "name": "Hindi",
        "bcp47": "hi",
        "file": "hindi.json"
      },
      {
        "id": "hungarian",
        "name": "Hungarian",
        "bcp47": "hu",
        "file": "hungarian.json"
      },
      {
        "id": "igbo",
        "name": "Igbo",
        "bcp47": "ig",
        "file": "igbo.json"
      },
      {
        "id": "indonesian",
        "name": "Indonesian",
        "bcp47": "id",
        "file": "indonesian.json"
      },
      {
        "id": "italian",
        "name": "Italian",
        "bcp47": "it",
        "file": "italian.json"
      },
      {
        "id": "japanese",
        "name": "Japanese",
        "bcp47": "ja",
        "file": "japanese.json"
      },
      {
        "id": "kannada",
        "name": "Kannada",
        "bcp47": "kn",
        "file": "kannada.json"
      },
      {
        "id": "kazakh",
        "name": "Kazakh",
        "bcp47": "kk",
        "file": "kazakh.json"
      },
      {
        "id": "khmer",
        "name": "Khmer",
        "bcp47": "km",
        "file": "khmer.json"
      },
      {
        "id": "kinyarwanda",
        "name": "Kinyarwanda",
        "bcp47": "rw",
        "file": "kinyarwanda.json"
      },
      {
        "id": "korean",
        "name": "Korean",
        "bcp47": "ko",
        "file": "korean.json"
      },
      {
        "id": "kurmanji",
        "name": "Kurmanji",
        "bcp47": "kmr",
        "file": "kurmanji.json"
      },
      {
        "id": "latvian",
        "name": "Latvian",
        "bcp47": "lv",
        "file": "latvian.json"
      },
      {
        "id": "lithuanian",
        "name": "Lithuanian",
        "bcp47": "lt",
        "file": "lithuanian.json"
      },
      {
        "id": "macedonian",
        "name": "Macedonian",
        "bcp47": "mk",
        "file": "macedonian.json"
      },
      {
        "id": "malagasy",
        "name": "Malagasy",
        "bcp47": "mg",
        "file": "malagasy.json"
      },
      {
        "id": "malay",
        "name": "Malay",
        "bcp47": "zsm",
        "file": "malay.json"
      },
      {
        "id": "malayalam",
        "name": "Malayalam",
        "bcp47": "ml",
        "file": "malayalam.json"
      },
      {
        "id": "maori",
        "name": "M\u0101ori",
        "bcp47": "mi",
        "file": "maori.json"
      },
      {
        "id": "marathi",
        "name": "Marathi",
        "bcp47": "mr",
        "file": "marathi.json"
      },
      {
        "id": "mongolian",
        "name": "Mongolian",
        "bcp47": "mn",
        "file": "mongolian.json"
      },
      {
        "id": "nepali",
        "name": "Nepali",
        "bcp47": "ne",
        "file": "nepali.json"
      },
      {
        "id": "norwegian",
        "name": "Norwegian",
        "bcp47": "no",
        "file": "norwegian.json"
      },
      {
        "id": "odia",
        "name": "Odia",
        "bcp47": "or",
        "file": "odia.json"
      },
      {
        "id": "oromo",
        "name": "Oromo",
        "bcp47": "om",
        "file": "oromo.json"
      },
      {
        "id": "pashto",
        "name": "Pashto",
        "bcp47": "ps",
        "file": "pashto.json"
      },
      {
        "id": "persian",
        "name": "Persian",
        "bcp47": "fa",
        "file": "persian.json"
      },
      {
        "id": "polish",
        "name": "Polish",
        "bcp47": "pl",
        "file": "polish.json"
      },
      {
        "id": "portuguese",
        "name": "Portuguese",
        "bcp47": "pt",
        "file": "portuguese.json"
      },
      {
        "id": "punjabi-gurmukhi",
        "name": "Punjabi (Gurmukhi)",
        "bcp47": "pa-Guru",
        "file": "punjabi-gurmukhi.json"
      },
      {
        "id": "punjabi-shahmukhi",
        "name": "Punjabi (Shahmukhi)",
        "bcp47": "pa-Arab",
        "file": "punjabi-shahmukhi.json"
      },
      {
        "id": "romanian",
        "name": "Romanian",
        "bcp47": "ro",
        "file": "romanian.json"
      },
      {
        "id": "russian",
        "name": "Russian",
        "bcp47": "ru",
        "file": "russian.json"
      },
      {
        "id": "serbian-cyrillic",
        "name": "Serbian (Cyrillic)",
        "bcp47": "sr-Cyrl",
        "file": "serbian-cyrillic.json"
      },
      {
        "id": "serbian-latin",
        "name": "Serbian (Latin)",
        "bcp47": "sr-Latn",
        "file": "serbian-latin.json"
      },
      {
        "id": "shona",
        "name": "Shona",
        "bcp47": "sn",
        "file": "shona.json"
      },
      {
        "id": "slovak",
        "name": "Slovak",
        "bcp47": "sk",
        "file": "slovak.json"
      },
      {
        "id": "slovenian",
        "name": "Slovenian",
        "bcp47": "sl",
        "file": "slovenian.json"
      },
      {
        "id": "somali",
        "name": "Somali",
        "bcp47": "so",
        "file": "somali.json"
      },
      {
        "id": "spanish",
        "name": "Spanish",
        "bcp47": "es",
        "file": "spanish.json"
      },
      {
        "id": "swahili",
        "name": "Swahili",
        "bcp47": "sw",
        "file": "swahili.json"
      },
      {
        "id": "swedish",
        "name": "Swedish",
        "bcp47": "sv",
        "file": "swedish.json"
      },
      {
        "id": "tagalog",
        "name": "Tagalog",
        "bcp47": "tl",
        "file": "tagalog.json"
      },
      {
        "id": "tajik",
        "name": "Tajik",
        "bcp47": "tg",
        "file": "tajik.json"
      },
      {
        "id": "tamil",
        "name": "Tamil",
        "bcp47": "ta",
        "file": "tamil.json"
      },
      {
        "id": "telugu",
        "name": "Telugu",
        "bcp47": "te",
        "file": "telugu.json"
      },
      {
        "id": "thai",
        "name": "Thai",
        "bcp47": "th",
        "file": "thai.json"
      },
      {
        "id": "turkish",
        "name": "Turkish",
        "bcp47": "tr",
        "file": "turkish.json"
      },
      {
        "id": "ukrainian",
        "name": "Ukrainian",
        "bcp47": "uk",
        "file": "ukrainian.json"
      },
      {
        "id": "urdu",
        "name": "Urdu",
        "bcp47": "ur",
        "file": "urdu.json"
      },
      {
        "id": "uzbek-latin",
        "name": "Uzbek (Latin)",
        "bcp47": "uz-Latn",
        "file": "uzbek-latin.json"
      },
      {
        "id": "vietnamese-quoc-ngu",
        "name": "Vietnamese (Qu\u1ED1c Ng\u1EEF)",
        "bcp47": "vi-Latn",
        "file": "vietnamese-quoc-ngu.json"
      },
      {
        "id": "xhosa",
        "name": "Xhosa",
        "bcp47": "xh",
        "file": "xhosa.json"
      },
      {
        "id": "yoruba",
        "name": "Yoruba",
        "bcp47": "yo",
        "file": "yoruba.json"
      },
      {
        "id": "zulu",
        "name": "Zulu",
        "bcp47": "zu",
        "file": "zulu.json"
      }
    ]
  },
  colorSchemes: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of color schemes available in the openpresentation.org catalog. Each entry is a lightweight summary; full color-scheme records live in the per-id JSON files alongside this index.",
    "records": [
      {
        "id": "black-and-white",
        "name": "Black & White",
        "file": "black-and-white.json"
      },
      {
        "id": "bold-red",
        "name": "Bold Red",
        "file": "bold-red.json"
      },
      {
        "id": "boost",
        "name": "Boost",
        "file": "boost.json"
      },
      {
        "id": "burnt-orange",
        "name": "Burnt Orange",
        "file": "burnt-orange.json"
      },
      {
        "id": "cool-horizon",
        "name": "Cool Horizon",
        "file": "cool-horizon.json"
      },
      {
        "id": "corporate-blue",
        "name": "Corporate Blue",
        "file": "corporate-blue.json"
      },
      {
        "id": "deep-purple",
        "name": "Deep Purple",
        "file": "deep-purple.json"
      },
      {
        "id": "forest-green",
        "name": "Forest Green",
        "file": "forest-green.json"
      },
      {
        "id": "golden-yellow",
        "name": "Golden Yellow",
        "file": "golden-yellow.json"
      },
      {
        "id": "luxury",
        "name": "Luxury",
        "file": "luxury.json"
      },
      {
        "id": "pastel-red",
        "name": "Pastel Red",
        "file": "pastel-red.json"
      },
      {
        "id": "slate-gray",
        "name": "Slate Gray",
        "file": "slate-gray.json"
      },
      {
        "id": "steel-blue",
        "name": "Steel Blue",
        "file": "steel-blue.json"
      },
      {
        "id": "vibes",
        "name": "Vibes",
        "file": "vibes.json"
      }
    ]
  },
  fontSchemes: {
    "$schema": "https://openpresentation.org/schema/opf-catalog-index/v1",
    "version": "1",
    "description": "Catalog of font schemes available in the openpresentation.org catalog. Each entry is a lightweight summary; full font-scheme records live in the per-id JSON files alongside this index.",
    "records": [
      {
        "id": "angsana-new",
        "name": "Angsana New",
        "file": "angsana-new.json"
      },
      {
        "id": "aparajita",
        "name": "Aparajita",
        "file": "aparajita.json"
      },
      {
        "id": "aptos",
        "name": "Aptos",
        "file": "aptos.json"
      },
      {
        "id": "arabic-typesetting",
        "name": "Arabic Typesetting",
        "file": "arabic-typesetting.json"
      },
      {
        "id": "arial",
        "name": "Arial",
        "file": "arial.json"
      },
      {
        "id": "batang",
        "name": "Batang",
        "file": "batang.json"
      },
      {
        "id": "bookman",
        "name": "Bookman",
        "file": "bookman.json"
      },
      {
        "id": "calibri",
        "name": "Calibri",
        "file": "calibri.json"
      },
      {
        "id": "century-schoolbook",
        "name": "Century Schoolbook",
        "file": "century-schoolbook.json"
      },
      {
        "id": "consolas",
        "name": "Consolas",
        "file": "consolas.json"
      },
      {
        "id": "constantia",
        "name": "Constantia",
        "file": "constantia.json"
      },
      {
        "id": "courier-new",
        "name": "Courier New",
        "file": "courier-new.json"
      },
      {
        "id": "daunpenh",
        "name": "DaunPenh",
        "file": "daunpenh.json"
      },
      {
        "id": "david",
        "name": "David",
        "file": "david.json"
      },
      {
        "id": "dilleniaupc",
        "name": "DilleniaUPC",
        "file": "dilleniaupc.json"
      },
      {
        "id": "fangsong",
        "name": "FangSong",
        "file": "fangsong.json"
      },
      {
        "id": "garamond",
        "name": "Garamond",
        "file": "garamond.json"
      },
      {
        "id": "gautami",
        "name": "Gautami",
        "file": "gautami.json"
      },
      {
        "id": "georgia",
        "name": "Georgia",
        "file": "georgia.json"
      },
      {
        "id": "gisha",
        "name": "Gisha",
        "file": "gisha.json"
      },
      {
        "id": "grandview",
        "name": "Grandview",
        "file": "grandview.json"
      },
      {
        "id": "gungsuh",
        "name": "Gungsuh",
        "file": "gungsuh.json"
      },
      {
        "id": "impact",
        "name": "Impact",
        "file": "impact.json"
      },
      {
        "id": "kalinga",
        "name": "Kalinga",
        "file": "kalinga.json"
      },
      {
        "id": "kartika",
        "name": "Kartika",
        "file": "kartika.json"
      },
      {
        "id": "khmer-ui",
        "name": "Khmer UI",
        "file": "khmer-ui.json"
      },
      {
        "id": "latha",
        "name": "Latha",
        "file": "latha.json"
      },
      {
        "id": "lucida-sans",
        "name": "Lucida Sans",
        "file": "lucida-sans.json"
      },
      {
        "id": "malgun-gothic",
        "name": "Malgun Gothic",
        "file": "malgun-gothic.json"
      },
      {
        "id": "mangal",
        "name": "Mangal",
        "file": "mangal.json"
      },
      {
        "id": "meiryo",
        "name": "Meiryo",
        "file": "meiryo.json"
      },
      {
        "id": "microsoft-jhenghei",
        "name": "Microsoft JhengHei",
        "file": "microsoft-jhenghei.json"
      },
      {
        "id": "microsoft-yahei",
        "name": "Microsoft Yahei",
        "file": "microsoft-yahei.json"
      },
      {
        "id": "mingliu",
        "name": "MingLiU",
        "file": "mingliu.json"
      },
      {
        "id": "miriam",
        "name": "Miriam",
        "file": "miriam.json"
      },
      {
        "id": "montserrat",
        "name": "Montserrat",
        "file": "montserrat.json"
      },
      {
        "id": "ms-mincho",
        "name": "MS Mincho",
        "file": "ms-mincho.json"
      },
      {
        "id": "nirmala-ui",
        "name": "Nirmala UI",
        "file": "nirmala-ui.json"
      },
      {
        "id": "noto-naksh-arabic",
        "name": "Noto Naskh Arabic",
        "file": "noto-naksh-arabic.json"
      },
      {
        "id": "noto-nastaliq-urdu",
        "name": "Noto Nastaliq Urdu",
        "file": "noto-nastaliq-urdu.json"
      },
      {
        "id": "noto-sans",
        "name": "Noto Sans",
        "file": "noto-sans.json"
      },
      {
        "id": "noto-sans-arabic",
        "name": "Noto Sans Arabic",
        "file": "noto-sans-arabic.json"
      },
      {
        "id": "noto-sans-armenian",
        "name": "Noto Sans Armenian",
        "file": "noto-sans-armenian.json"
      },
      {
        "id": "noto-sans-bengali",
        "name": "Noto Sans Bengali",
        "file": "noto-sans-bengali.json"
      },
      {
        "id": "noto-sans-devangari",
        "name": "Noto Sans Devanagari",
        "file": "noto-sans-devangari.json"
      },
      {
        "id": "noto-sans-ethiopic",
        "name": "Noto Sans Ethiopic",
        "file": "noto-sans-ethiopic.json"
      },
      {
        "id": "noto-sans-georgian",
        "name": "Noto Sans Georgian",
        "file": "noto-sans-georgian.json"
      },
      {
        "id": "noto-sans-gujarati",
        "name": "Noto Sans Gujarati",
        "file": "noto-sans-gujarati.json"
      },
      {
        "id": "noto-sans-gurmukhi",
        "name": "Noto Sans Gurmukhi",
        "file": "noto-sans-gurmukhi.json"
      },
      {
        "id": "noto-sans-hebrew",
        "name": "Noto Sans Hebrew",
        "file": "noto-sans-hebrew.json"
      },
      {
        "id": "noto-sans-jp",
        "name": "Noto Sans JP",
        "file": "noto-sans-jp.json"
      },
      {
        "id": "noto-sans-kannada",
        "name": "Noto Sans Kannada",
        "file": "noto-sans-kannada.json"
      },
      {
        "id": "noto-sans-khmer",
        "name": "Noto Sans Khmer",
        "file": "noto-sans-khmer.json"
      },
      {
        "id": "noto-sans-kr",
        "name": "Noto Sans KR",
        "file": "noto-sans-kr.json"
      },
      {
        "id": "noto-sans-malayalam",
        "name": "Noto Sans Malayalam",
        "file": "noto-sans-malayalam.json"
      },
      {
        "id": "noto-sans-mongolian",
        "name": "Noto Sans Mongolian",
        "file": "noto-sans-mongolian.json"
      },
      {
        "id": "noto-sans-oriya",
        "name": "Noto Sans Oriya",
        "file": "noto-sans-oriya.json"
      },
      {
        "id": "noto-sans-sc",
        "name": "Noto Sans SC",
        "file": "noto-sans-sc.json"
      },
      {
        "id": "noto-sans-tamil",
        "name": "Noto Sans Tamil",
        "file": "noto-sans-tamil.json"
      },
      {
        "id": "noto-sans-tc",
        "name": "Noto Sans TC",
        "file": "noto-sans-tc.json"
      },
      {
        "id": "noto-sans-telugu",
        "name": "Noto Sans Telugu",
        "file": "noto-sans-telugu.json"
      },
      {
        "id": "noto-sans-thai",
        "name": "Noto Sans Thai",
        "file": "noto-sans-thai.json"
      },
      {
        "id": "nyala",
        "name": "Nyala",
        "file": "nyala.json"
      },
      {
        "id": "open-sans",
        "name": "Open Sans",
        "file": "open-sans.json"
      },
      {
        "id": "pmingliu",
        "name": "PMingLiU",
        "file": "pmingliu.json"
      },
      {
        "id": "poppins",
        "name": "Poppins",
        "file": "poppins.json"
      },
      {
        "id": "pt-serif",
        "name": "PT Serif",
        "file": "pt-serif.json"
      },
      {
        "id": "raavi",
        "name": "Raavi",
        "file": "raavi.json"
      },
      {
        "id": "raleway",
        "name": "Raleway",
        "file": "raleway.json"
      },
      {
        "id": "roboto",
        "name": "Roboto",
        "file": "roboto.json"
      },
      {
        "id": "rockwell",
        "name": "Rockwell",
        "file": "rockwell.json"
      },
      {
        "id": "sakkal-majalla",
        "name": "Sakkal Majalla",
        "file": "sakkal-majalla.json"
      },
      {
        "id": "seaford",
        "name": "Seaford",
        "file": "seaford.json"
      },
      {
        "id": "segoe-ui",
        "name": "Segoe UI",
        "file": "segoe-ui.json"
      },
      {
        "id": "segoe-ui-light",
        "name": "Segoe UI Light",
        "file": "segoe-ui-light.json"
      },
      {
        "id": "shonar-bangla",
        "name": "Shonar Bangla",
        "file": "shonar-bangla.json"
      },
      {
        "id": "shruti",
        "name": "Shruti",
        "file": "shruti.json"
      },
      {
        "id": "simsun",
        "name": "SimSun",
        "file": "simsun.json"
      },
      {
        "id": "skeena",
        "name": "Skeena",
        "file": "skeena.json"
      },
      {
        "id": "sylfaen",
        "name": "Sylfaen",
        "file": "sylfaen.json"
      },
      {
        "id": "tahoma",
        "name": "Tahoma",
        "file": "tahoma.json"
      },
      {
        "id": "tenorite",
        "name": "Tenorite",
        "file": "tenorite.json"
      },
      {
        "id": "times-new-roman",
        "name": "Times New Roman",
        "file": "times-new-roman.json"
      },
      {
        "id": "traditional-arabic",
        "name": "Traditional Arabic",
        "file": "traditional-arabic.json"
      },
      {
        "id": "trebuchet-ms",
        "name": "Trebuchet MS",
        "file": "trebuchet-ms.json"
      },
      {
        "id": "tunga",
        "name": "Tunga",
        "file": "tunga.json"
      },
      {
        "id": "verdana",
        "name": "Verdana",
        "file": "verdana.json"
      },
      {
        "id": "vrinda",
        "name": "Vrinda",
        "file": "vrinda.json"
      },
      {
        "id": "yu-gothic",
        "name": "Yu Gothic",
        "file": "yu-gothic.json"
      }
    ]
  }
};
var catalogSchemaNames = {
  audiences: "audience",
  purposes: "purpose",
  tones: "tone",
  themes: "theme",
  layouts: "layout",
  chartTypes: "chartType",
  narratives: "narrative",
  socialPlatforms: "socialPlatform",
  languages: "language",
  colorSchemes: "colorScheme",
  fontSchemes: "fontScheme"
};
var catalogKinds = [
  "audiences",
  "purposes",
  "tones",
  "themes",
  "layouts",
  "chartTypes",
  "narratives",
  "socialPlatforms",
  "languages",
  "colorSchemes",
  "fontSchemes"
];
var catalogEntries = [
  { kind: "audiences", schemaName: "audience", dir: "catalogs/audiences", files: [
    "executives.json",
    "board.json",
    "engineering-team.json",
    "investors.json",
    "customers.json",
    "sales-team.json",
    "marketing-team.json",
    "all-hands.json",
    "candidates.json",
    "regulators.json"
  ], records: audiences, index: catalogIndexes.audiences },
  { kind: "purposes", schemaName: "purpose", dir: "catalogs/purposes", files: [
    "inform.json",
    "decide.json",
    "align.json",
    "persuade.json",
    "educate.json",
    "report.json",
    "pitch.json",
    "sell.json",
    "plan.json"
  ], records: purposes, index: catalogIndexes.purposes },
  { kind: "tones", schemaName: "tone", dir: "catalogs/tones", files: [
    "formal.json",
    "casual.json",
    "inspirational.json",
    "technical.json",
    "persuasive.json",
    "authoritative.json",
    "conversational.json"
  ], records: tones, index: catalogIndexes.tones },
  { kind: "themes", schemaName: "theme", dir: "catalogs/themes", files: [
    "bold.json",
    "classic.json",
    "dark.json",
    "minimal.json"
  ], records: themes, index: catalogIndexes.themes },
  { kind: "layouts", schemaName: "layout", dir: "catalogs/layouts", files: [
    "blank.json",
    "chart-1x.json",
    "chart-2x.json",
    "chart-3x.json",
    "code-1x.json",
    "image-1x.json",
    "image-2x.json",
    "image-3x.json",
    "image-bleed.json",
    "list-1x.json",
    "list-2x.json",
    "list-3x.json",
    "list-4x.json",
    "list-5x.json",
    "list-6x.json",
    "media-1x.json",
    "number-1x.json",
    "number-2x.json",
    "number-3x.json",
    "number-4x.json",
    "number-5x.json",
    "number-6x.json",
    "table-1x.json",
    "text-1x.json",
    "text-2x.json",
    "text-3x.json",
    "title.json",
    "title-subtitle.json"
  ], records: layouts, index: catalogIndexes.layouts },
  { kind: "chartTypes", schemaName: "chartType", dir: "catalogs/chart-types", files: [
    "100pct-bullet-bar.json",
    "100pct-bullet-bar-2x.json",
    "100pct-bullet-bar-3x.json",
    "100pct-bullet-column.json",
    "100pct-bullet-column-2x.json",
    "100pct-bullet-column-3x.json",
    "100pct-progress-bar.json",
    "100pct-stacked-area-2x.json",
    "100pct-stacked-area-3x.json",
    "100pct-stacked-bar-2x.json",
    "100pct-stacked-bar-3x.json",
    "100pct-stacked-column-2x.json",
    "100pct-stacked-column-3x.json",
    "area.json",
    "australia.json",
    "bar.json",
    "box-and-whisker.json",
    "box-and-whisker-2x.json",
    "box-and-whisker-3x.json",
    "bullet-bar.json",
    "bullet-bar-2x.json",
    "bullet-bar-3x.json",
    "bullet-column.json",
    "bullet-column-2x.json",
    "bullet-column-3x.json",
    "canada.json",
    "clustered-bar-2x.json",
    "clustered-column.json",
    "column.json",
    "dot-plot.json",
    "dot-plot-2x.json",
    "dot-plot-3x.json",
    "dot-plot-4x.json",
    "dot-plot-5x.json",
    "dot-plot-6x.json",
    "doughnut.json",
    "dumbbell.json",
    "filled-radar.json",
    "funnel.json",
    "histogram.json",
    "line.json",
    "line-2x.json",
    "line-3x.json",
    "line-with-high-low.json",
    "line-with-high-low-and-markers.json",
    "line-with-markers.json",
    "line-with-markers-2x.json",
    "line-with-markers-3x.json",
    "pareto.json",
    "pie.json",
    "radar.json",
    "radar-with-markers.json",
    "scatter.json",
    "sparkline.json",
    "sparkline-2x.json",
    "sparkline-3x.json",
    "sparkline-4x.json",
    "sparkline-5x.json",
    "sparkline-6x.json",
    "stacked-area-2x.json",
    "stacked-area-3x.json",
    "stacked-bar-2x.json",
    "stacked-bar-3x.json",
    "stacked-column-2x.json",
    "stacked-column-3x.json",
    "stacked-line-2x.json",
    "stacked-line-3x.json",
    "stacked-line-with-markers-2x.json",
    "stacked-line-with-markers-3x.json",
    "treemap.json",
    "treemap-2x.json",
    "treemap-3x.json",
    "united-kingdom.json",
    "united-states.json",
    "waterfall.json",
    "world.json"
  ], records: chartTypes, index: catalogIndexes.chartTypes },
  { kind: "narratives", schemaName: "narrative", dir: "catalogs/narratives", files: [
    "problem-solution.json",
    "scqa.json",
    "strategic-narrative.json",
    "golden-circle.json",
    "conference-talk.json",
    "transformation-arc.json",
    "pitch-deck.json",
    "early-startup-pitch.json",
    "venture-pitch.json",
    "persuasive-sales.json",
    "company-intro.json",
    "marketing-strategy.json",
    "product-launch.json",
    "strategic-advisory.json",
    "challenge-resolution.json",
    "project-proposal.json",
    "failure-analysis.json",
    "classic-story.json",
    "business-narrative.json",
    "rags-to-riches.json",
    "underdog-victory.json",
    "survival-story.json",
    "educate.json",
    "persuade.json",
    "reveal.json",
    "justice.json",
    "innovation.json",
    "focus.json",
    "qbr.json",
    "business-review.json",
    "board-meeting.json",
    "weekly-progress.json",
    "status-update.json",
    "performance-review.json",
    "survey-analysis.json",
    "trend-analysis.json",
    "employee-review.json",
    "performance-improvement-plan.json",
    "capacity-planning.json"
  ], records: narratives, index: catalogIndexes.narratives },
  { kind: "socialPlatforms", schemaName: "socialPlatform", dir: "catalogs/social-platforms", files: [
    "linkedin.json",
    "x.json",
    "github.json",
    "youtube.json",
    "instagram.json",
    "facebook.json",
    "tiktok.json",
    "threads.json",
    "mastodon.json",
    "bluesky.json"
  ], records: socialPlatforms, index: catalogIndexes.socialPlatforms },
  { kind: "languages", schemaName: "language", dir: "catalogs/languages", files: [
    "afrikaans.json",
    "albanian.json",
    "amharic.json",
    "arabic.json",
    "armenian.json",
    "aymara.json",
    "azerbaijani.json",
    "bengali.json",
    "berber-latin.json",
    "bosnian-latin.json",
    "bulgarian.json",
    "catalan.json",
    "cebuano.json",
    "chinese-simplified.json",
    "chinese-traditional.json",
    "chittagonian.json",
    "croatian.json",
    "czech.json",
    "danish.json",
    "dutch.json",
    "english.json",
    "english-au.json",
    "english-ca.json",
    "english-gb.json",
    "english-in.json",
    "english-us.json",
    "estonian.json",
    "filipino.json",
    "finnish.json",
    "french.json",
    "fulfulde.json",
    "galician.json",
    "georgian.json",
    "german.json",
    "greek.json",
    "gujarati.json",
    "hausa.json",
    "hebrew.json",
    "hindi.json",
    "hungarian.json",
    "igbo.json",
    "indonesian.json",
    "italian.json",
    "japanese.json",
    "kannada.json",
    "kazakh.json",
    "khmer.json",
    "kinyarwanda.json",
    "korean.json",
    "kurmanji.json",
    "latvian.json",
    "lithuanian.json",
    "macedonian.json",
    "malagasy.json",
    "malay.json",
    "malayalam.json",
    "maori.json",
    "marathi.json",
    "mongolian.json",
    "nepali.json",
    "norwegian.json",
    "odia.json",
    "oromo.json",
    "pashto.json",
    "persian.json",
    "polish.json",
    "portuguese.json",
    "punjabi-gurmukhi.json",
    "punjabi-shahmukhi.json",
    "romanian.json",
    "russian.json",
    "serbian-cyrillic.json",
    "serbian-latin.json",
    "shona.json",
    "slovak.json",
    "slovenian.json",
    "somali.json",
    "spanish.json",
    "swahili.json",
    "swedish.json",
    "tagalog.json",
    "tajik.json",
    "tamil.json",
    "telugu.json",
    "thai.json",
    "turkish.json",
    "ukrainian.json",
    "urdu.json",
    "uzbek-latin.json",
    "vietnamese-quoc-ngu.json",
    "xhosa.json",
    "yoruba.json",
    "zulu.json"
  ], records: languages, index: catalogIndexes.languages },
  { kind: "colorSchemes", schemaName: "colorScheme", dir: "catalogs/color-schemes", files: [
    "black-and-white.json",
    "bold-red.json",
    "boost.json",
    "burnt-orange.json",
    "cool-horizon.json",
    "corporate-blue.json",
    "deep-purple.json",
    "forest-green.json",
    "golden-yellow.json",
    "luxury.json",
    "pastel-red.json",
    "slate-gray.json",
    "steel-blue.json",
    "vibes.json"
  ], records: colorSchemes, index: catalogIndexes.colorSchemes },
  { kind: "fontSchemes", schemaName: "fontScheme", dir: "catalogs/font-schemes", files: [
    "angsana-new.json",
    "aparajita.json",
    "aptos.json",
    "arabic-typesetting.json",
    "arial.json",
    "batang.json",
    "bookman.json",
    "calibri.json",
    "century-schoolbook.json",
    "consolas.json",
    "constantia.json",
    "courier-new.json",
    "daunpenh.json",
    "david.json",
    "dilleniaupc.json",
    "fangsong.json",
    "garamond.json",
    "gautami.json",
    "georgia.json",
    "gisha.json",
    "grandview.json",
    "gungsuh.json",
    "impact.json",
    "kalinga.json",
    "kartika.json",
    "khmer-ui.json",
    "latha.json",
    "lucida-sans.json",
    "malgun-gothic.json",
    "mangal.json",
    "meiryo.json",
    "microsoft-jhenghei.json",
    "microsoft-yahei.json",
    "mingliu.json",
    "miriam.json",
    "montserrat.json",
    "ms-mincho.json",
    "nirmala-ui.json",
    "noto-naksh-arabic.json",
    "noto-nastaliq-urdu.json",
    "noto-sans.json",
    "noto-sans-arabic.json",
    "noto-sans-armenian.json",
    "noto-sans-bengali.json",
    "noto-sans-devangari.json",
    "noto-sans-ethiopic.json",
    "noto-sans-georgian.json",
    "noto-sans-gujarati.json",
    "noto-sans-gurmukhi.json",
    "noto-sans-hebrew.json",
    "noto-sans-jp.json",
    "noto-sans-kannada.json",
    "noto-sans-khmer.json",
    "noto-sans-kr.json",
    "noto-sans-malayalam.json",
    "noto-sans-mongolian.json",
    "noto-sans-oriya.json",
    "noto-sans-sc.json",
    "noto-sans-tamil.json",
    "noto-sans-tc.json",
    "noto-sans-telugu.json",
    "noto-sans-thai.json",
    "nyala.json",
    "open-sans.json",
    "pmingliu.json",
    "poppins.json",
    "pt-serif.json",
    "raavi.json",
    "raleway.json",
    "roboto.json",
    "rockwell.json",
    "sakkal-majalla.json",
    "seaford.json",
    "segoe-ui.json",
    "segoe-ui-light.json",
    "shonar-bangla.json",
    "shruti.json",
    "simsun.json",
    "skeena.json",
    "sylfaen.json",
    "tahoma.json",
    "tenorite.json",
    "times-new-roman.json",
    "traditional-arabic.json",
    "trebuchet-ms.json",
    "tunga.json",
    "verdana.json",
    "vrinda.json",
    "yu-gothic.json"
  ], records: fontSchemes, index: catalogIndexes.fontSchemes }
];

export { audiences, catalogEntries, catalogIndexes, catalogKinds, catalogSchemaNames, catalogs, chartTypes, colorSchemes, fontSchemes, languages, layouts, narratives, purposes, socialPlatforms, themes, tones };
