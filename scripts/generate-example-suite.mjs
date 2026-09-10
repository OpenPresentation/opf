import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = path.join(repoRoot, "examples", "gallery");
const catalogRoot = path.join(repoRoot, "spec", "catalogs");

const schemaId = "https://openpresentation.org/schema/opf/v1";

const scenarioSpecs = [
  ["industries", "Ambulatory Access Recovery Plan", "Northstar Care Network", "Healthcare operations", "Reduce missed appointments while protecting clinician capacity"],
  ["industries", "Branch Modernization Investment Case", "Harborline Bank", "Financial services", "Prioritize digital branch upgrades by customer value and risk"],
  ["industries", "Cold Chain Waste Reduction Review", "Greenbasket Markets", "Retail grocery", "Cut shrink across produce and prepared foods without hurting freshness"],
  ["industries", "Robotics Quality Escape Briefing", "Axis Forge Robotics", "Advanced manufacturing", "Lower rework on the actuator line before the seasonal volume ramp"],
  ["industries", "Grid Resilience Capital Plan", "HelioGrid Utilities", "Energy utilities", "Approve the substation hardening program for the next budget cycle"],
  ["industries", "Streaming Churn Winback Strategy", "Signalhouse Media", "Media and entertainment", "Reverse premium subscriber churn with better lifecycle moments"],
  ["industries", "Port Dwell Time Improvement Plan", "Bluewater Logistics", "Ports and logistics", "Reduce container dwell time through scheduling and yard visibility"],
  ["industries", "Water Stewardship Grower Brief", "Sunfield Cooperative", "Agriculture", "Align growers on irrigation telemetry and drought response"],
  ["industries", "Boutique Hotel Revenue Recovery", "Harbor & Loom Hotels", "Hospitality", "Recover weekday occupancy through segmented offers and events"],
  ["industries", "Mixed Use Leasing Pipeline Review", "Cedarwell Properties", "Commercial real estate", "Move anchor tenants from interest to signed letters of intent"],
  ["industries", "Rural Broadband Expansion Proposal", "MesaLink Fiber", "Telecommunications", "Secure local support for phase two broadband construction"],
  ["industries", "Claims Triage Operating Model", "Pinnacle Mutual", "Insurance", "Speed low-complexity claims while preserving adjuster judgment"],
  ["industries", "Trial Enrollment Rescue Plan", "Novara Therapeutics", "Pharmaceuticals", "Restore patient enrollment momentum across priority sites"],
  ["industries", "Satellite Maintenance Readiness Review", "Orbital Ridge Systems", "Aerospace", "Prepare fleet support teams for the next launch window"],
  ["industries", "Consulting Margin Recovery Plan", "North Pier Advisory", "Professional services", "Improve delivery margin without degrading client outcomes"],
  ["industries", "Drive Thru Throughput Playbook", "Tempo Burger Group", "Quick service restaurants", "Increase lunch peak capacity with staffing and menu simplification"],
  ["industries", "Battery Line Supplier Readiness", "Voltcrest Components", "Automotive supply", "Qualify suppliers for the new battery enclosure line"],
  ["industries", "Construction Safety Stand Down", "Keystone Build Partners", "Construction", "Reset field safety practices before tower crane installation"],
  ["industries", "Airline Disruption Recovery Review", "AeroVista Airlines", "Air travel", "Shorten recovery time after weather-driven network disruption"],
  ["industries", "Tailings Monitoring Investment Brief", "Copper Mesa Mining", "Mining", "Fund remote monitoring for high-priority containment sites"],
  ["industries", "Food Bank Distribution Capacity Plan", "Common Table Network", "Nonprofit food security", "Expand distribution throughput before the summer demand spike"],
  ["industries", "Managed Detection Market Update", "Sentinel Harbor Security", "Cybersecurity services", "Reposition managed detection for mid-market buyers"],
  ["industries", "Veterinary Staffing Stabilization", "Oaktrail Animal Health", "Veterinary care", "Balance appointment access with staff retention"],
  ["industries", "Fan Experience Operations Brief", "Summit Park Arena", "Sports venues", "Improve entry, concessions, and post-event transit flow"],
  ["industries", "Retail Launch Readiness Deck", "Bloom & Anchor Beauty", "Beauty retail", "Coordinate field teams for a national product launch"],

  ["business-functions", "Enterprise Account Expansion Plan", "AtlasWorks", "Sales", "Grow the strategic account through a measurable multi-threaded plan"],
  ["business-functions", "Demand Generation Campaign Brief", "Brightpath Analytics", "Marketing", "Launch an integrated campaign around the new benchmark report"],
  ["business-functions", "Product Roadmap Decision Review", "LatticeLane", "Product", "Decide which roadmap bets move into the second half build window"],
  ["business-functions", "Engineering Capacity Planning", "Relay Cloud", "Engineering", "Balance platform reliability work with customer-facing commitments"],
  ["business-functions", "S&OP Exception Review", "Cobalt Supply", "Operations", "Resolve demand and supply gaps before the monthly consensus call"],
  ["business-functions", "FY27 Budget Tradeoff Deck", "Morrow Labs", "Finance", "Align investment choices to margin and growth guardrails"],
  ["business-functions", "Onboarding Experience Redesign", "Kindred Systems", "Human resources", "Reduce new-hire time to productivity with clearer role paths"],
  ["business-functions", "Contract Cycle Time Brief", "Juniper Legal", "Legal operations", "Shorten commercial contract review while managing risk"],
  ["business-functions", "Identity Incident Executive Brief", "Sable Systems", "Security", "Explain incident response status and the residual risk plan"],
  ["business-functions", "Support Deflection Program", "Waypoint Apps", "Customer support", "Move repetitive questions into self-service without hurting CSAT"],
  ["business-functions", "Renewal Save Plan", "Evergreen CRM", "Customer success", "Recover at-risk renewals with executive sponsorship and value proof"],
  ["business-functions", "Supplier Risk Heatmap", "Ironwood Devices", "Procurement", "Prioritize second-source work for the highest-risk suppliers"],
  ["business-functions", "Strategy Offsite Pre-Read", "Northstar Studio", "Corporate strategy", "Focus leadership debate on the few choices that matter"],
  ["business-functions", "Model Governance Review", "ClearLake Data", "Analytics", "Approve controls for customer-facing predictive models"],
  ["business-functions", "Data Platform Migration Plan", "Fathom Retail", "Data engineering", "Move analytics workloads with minimal reporting disruption"],
  ["business-functions", "Employee Town Hall Run of Show", "Copperline Health", "Corporate communications", "Align leaders on narrative, timing, and live questions"],
  ["business-functions", "Partner Ecosystem Launch Kit", "Meridian Cloud", "Partnerships", "Help regional partners explain the new integration story"],
  ["business-functions", "Defect Escape Reduction Review", "Pioneer Instruments", "Quality assurance", "Reduce high-severity escapes through earlier verification"],
  ["business-functions", "Workplace Occupancy Reset", "SilverOak Group", "Facilities", "Right-size office services around actual hybrid usage"],
  ["business-functions", "Scope 3 Reporting Readiness", "Lumina Foods", "Sustainability", "Prepare supplier data collection for annual climate reporting"],
  ["business-functions", "Field Enablement Certification", "NimbleOps", "Training and enablement", "Certify sellers on the new value narrative before launch"],
  ["business-functions", "Revenue Forecast Inspection", "FoundryGrid", "Revenue operations", "Improve forecast quality by focusing on stage hygiene"],
  ["business-functions", "Pricing and Packaging Decision", "Northbeam Software", "Pricing", "Select the packaging move that improves conversion and expansion"],
  ["business-functions", "Compliance Readiness Review", "Tandem BioSystems", "Compliance", "Close audit evidence gaps before external assessment"],
  ["business-functions", "Investor Relations Update", "Asteria Robotics", "Investor relations", "Prepare the quarter narrative for public-market investors"],

  ["education", "District Literacy Acceleration Plan", "Riverbend Public Schools", "K-12 education", "Raise third-grade reading proficiency through targeted intervention"],
  ["education", "STEM Lab Funding Proposal", "Prairie Ridge High School", "K-12 education", "Secure funding for hands-on robotics and chemistry labs"],
  ["education", "Campus Energy Action Brief", "Lakeside University", "Higher education", "Reduce campus energy use without disrupting instruction"],
  ["education", "Online Program Launch Plan", "Western Coast College", "Higher education", "Launch a flexible certificate program for working adults"],
  ["education", "Advising Retention Review", "North Valley State", "Student success", "Improve first-year retention through proactive advising"],
  ["education", "Research Grant Pitch", "Center for Urban Oceans", "Research", "Win support for a cross-disciplinary coastal resilience study"],
  ["education", "Workforce Pathway Partnership", "Metro Technical College", "Community college", "Connect employer demand to short-cycle training capacity"],
  ["education", "Library Modernization Roadmap", "Easton University Library", "Academic library", "Shift the library from stacks-first to research-services-first"],
  ["education", "Athletics Budget Review", "Summit State Athletics", "College athletics", "Balance competitive goals with travel and facility constraints"],
  ["education", "Curriculum Approval Brief", "Oakbridge Faculty Senate", "Academic governance", "Approve a revised data ethics requirement"],
  ["education", "School Safety Preparedness Brief", "Granite Falls District", "School operations", "Clarify safety protocols before the fall semester"],
  ["education", "Special Education Services Plan", "Canyon Unified Schools", "Student services", "Improve evaluation timelines and family communication"],
  ["education", "Alumni Giving Campaign", "Redwood College Foundation", "Advancement", "Increase alumni participation through a class-year challenge"],
  ["education", "Student Mental Health Capacity Review", "Harbor City University", "Student affairs", "Expand counseling access through stepped-care delivery"],
  ["education", "Apprenticeship Partnership Deck", "Lakeview Tech Institute", "Workforce education", "Recruit employers into a paid apprenticeship consortium"],

  ["government", "Vaccination Outreach Briefing", "County Health Alliance", "Public health", "Increase booster uptake in neighborhoods with low access"],
  ["government", "Housing Zoning Council Brief", "City of Redwood Falls", "City government", "Prepare council to vote on mixed-income zoning changes"],
  ["government", "Transit Corridor Alternatives", "Metro Transit Authority", "Transportation", "Compare bus rapid transit options for the east corridor"],
  ["government", "Wildfire Evacuation Preparedness", "Pine County Emergency Management", "Emergency management", "Coordinate evacuation roles before fire season"],
  ["government", "Water Utility Capital Plan", "Lakehaven Water District", "Public utilities", "Approve staged replacement of high-risk mains"],
  ["government", "Digital Services Modernization", "State Service Office", "Digital government", "Improve permit experience through one-stop online services"],
  ["government", "Grant Equity Review", "Civic Arts Commission", "Grantmaking", "Make award decisions more transparent and accessible"],
  ["government", "Regulatory Risk Brief", "Regional Clean Air Board", "Regulators", "Align inspectors on risk-based compliance priorities"],
  ["government", "Court Backlog Reduction Plan", "County Court Administration", "Justice administration", "Reduce case backlog through calendar redesign"],
  ["government", "Police Training Program Update", "North Metro Police Academy", "Public safety", "Update scenario training around de-escalation and reporting"],
  ["government", "Parks Master Plan Workshop", "Greenway Parks Department", "Parks and recreation", "Gather resident input on park access and maintenance"],
  ["government", "Recycling Participation Campaign", "City Sanitation Bureau", "Sanitation", "Increase household recycling participation with clearer guidance"],
  ["government", "Workforce Reskilling Initiative", "State Workforce Board", "Workforce development", "Prepare displaced workers for regional growth sectors"],
  ["government", "Tax Portal Modernization", "Department of Revenue Services", "Tax administration", "Reduce filing friction and call center demand"],
  ["government", "Broadband Public Hearing Deck", "Rural Connectivity Office", "Public engagement", "Explain broadband route choices and resident impact"],

  ["presentation-types", "Seed Pitch for Climate Risk API", "Climara", "Seed pitch", "Raise a seed round for climate risk intelligence"],
  ["presentation-types", "Monthly Board Update", "North Pier Health", "Board update", "Give directors the concise operating picture and needed decisions"],
  ["presentation-types", "Customer QBR Renewal Deck", "Apex Support Cloud", "QBR", "Prove realized value and align on next-quarter expansion"],
  ["presentation-types", "Developer Conference Talk", "VectorTrail", "Conference talk", "Teach builders how to design observable agent workflows"],
  ["presentation-types", "Executive Workshop Facilitation", "Mosaic Strategy", "Workshop", "Guide leaders from issue framing to committed next steps"],
  ["presentation-types", "Data Incident Postmortem", "Granite ID", "Incident review", "Explain what happened and what changes prevent recurrence"],
  ["presentation-types", "Product Launch Narrative", "Kiteframe", "Product launch", "Coordinate launch story, proof, and field actions"],
  ["presentation-types", "Policy Briefing for Advisors", "Civic Futures Lab", "Policy briefing", "Frame tradeoffs for a pending legislative decision"],
  ["presentation-types", "Manager Training Deck", "PeopleCraft", "Training", "Teach managers a repeatable coaching conversation model"],
  ["presentation-types", "Research Findings Report", "Blue Ridge Institute", "Research report", "Turn survey results into decisions for program design"],

  ["international", "Japan Market Entry Readout", "Northstar Robotics Japan", "International expansion", "Localize sales motion and support model for Japan"],
  ["international", "India Rural Payments Pilot", "Sahyog Pay", "Financial inclusion", "Evaluate pilot results before expanding rural merchant coverage"],
  ["international", "Brazil Climate Adaptation Brief", "Instituto Verde Norte", "Climate adaptation", "Align municipal leaders on flood-readiness investments"],
  ["international", "German Works Council Update", "RheinWorks Mobility", "Labor relations", "Explain automation plans and worker safeguards clearly"],
  ["international", "Arabic Digital Services Brief", "Crescent Public Services", "Public services", "Present a service redesign for Arabic-first residents"],

  ["design-and-media", "Visual Brand System Sampler", "Framewell Studio", "Design system", "Demonstrate OPF design controls across a reusable brand system"],
  ["design-and-media", "Video Demo Sales Narrative", "SignalKit", "Sales demo", "Combine video proof and business case in a compact sales deck"],
  ["design-and-media", "Photo Essay Portfolio", "Urban Lens Collective", "Portfolio", "Tell a coherent civic story through image-heavy slides"],
  ["design-and-media", "Data Storytelling Atlas", "Civic Data Lab", "Data storytelling", "Show regional patterns with maps, charts, and concise interpretation"],
  ["design-and-media", "Kiosk Orientation Deck", "Northgate Museum", "Visitor orientation", "Prepare a self-running lobby deck with concise navigation cues"],
];

if (scenarioSpecs.length !== 100) {
  throw new Error(`Expected 100 scenario specs, found ${scenarioSpecs.length}`);
}

const catalogKinds = {
  audiences: "audiences",
  chartTypes: "chart-types",
  colorSchemes: "color-schemes",
  fontSchemes: "font-schemes",
  languages: "languages",
  layouts: "layouts",
  narratives: "narratives",
  purposes: "purposes",
  socialPlatforms: "social-platforms",
  themes: "themes",
  tones: "tones",
};

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadCatalogIds(kind) {
  const entries = await readdir(path.join(catalogRoot, kind), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => name.replace(/\.json$/, ""))
    .sort((a, b) => a.localeCompare(b));
}

function pick(values, index, offset = 0) {
  return values[(index + offset) % values.length];
}

function titleCase(value) {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function orgId(name) {
  return slug(name).slice(0, 36);
}

function orgDomain(name) {
  return `${slug(name)}.example`;
}

function legalNameFor(spec) {
  if (spec.folder === "government" || spec.folder === "education") return spec.org;
  if (spec.area.toLowerCase().includes("nonprofit")) return spec.org;
  if (spec.area.toLowerCase().includes("public")) return spec.org;
  if (spec.org.includes("Foundation") || spec.org.includes("Commission") || spec.org.includes("Department")) return spec.org;
  return `${spec.org}, Inc.`;
}

function metricValue(index) {
  const values = ["18%", "$4.8M", "11 days", "2.4x", "91%", "42 pts", "$820K", "31%"];
  return values[index % values.length];
}

function evidenceMetric(index) {
  // Fictional gallery data: keep each value, unit and change dimensionally consistent.
  // Currency stays formatted in value because OPF's unit follows the value.
  const samples = [
    { value: 18, unit: "%", delta: "+6 pts", trend: "up" },
    { value: "$4.8M", delta: "+$0.3M", trend: "up" },
    { value: 11, unit: "days", delta: "-3 days", trend: "down" },
    { value: 2.4, unit: "x", delta: "+0.3x", trend: "up" },
    { value: 91, unit: "%", delta: "+6 pts", trend: "up" },
    { value: 42, unit: "pts", delta: "+6 pts", trend: "up" },
    { value: "$820K", delta: "+$20K", trend: "up" },
    { value: 31, unit: "%", delta: "+6 pts", trend: "up" },
  ];
  return { ...samples[index % samples.length], label: "Illustrative result" };
}

function trend(index) {
  return ["up", "flat", "down"][index % 3];
}

function color(index, offset = 0) {
  const palette = [
    "#0F172A",
    "#1D4ED8",
    "#047857",
    "#B45309",
    "#BE123C",
    "#6D28D9",
    "#0369A1",
    "#334155",
    "#F8FAFC",
    "#E2E8F0",
    "#F59E0B",
    "#14B8A6",
  ];
  return pick(palette, index, offset);
}

function backgroundFor(index) {
  const variants = [
    "light1",
    "dark1",
    "#F8FAFC",
    { type: "theme", slot: "light2" },
    { type: "solid", color: "#FFFFFF", opacity: 1 },
    {
      type: "gradient",
      gradient: {
        angle: 35,
        stops: [
          { color: color(index, 1), position: 0 },
          { color: color(index, 4), position: 1 },
        ],
      },
      opacity: 0.94,
    },
    {
      type: "image",
      image: { src: "asset:cover-bg", fit: "cover" },
      opacity: 0.2,
    },
    {
      type: "pattern",
      pattern: {
        preset: "diagStripe",
        foregroundColor: "#CBD5E1",
        backgroundColor: "#FFFFFF",
      },
      opacity: 0.18,
    },
  ];
  return pick(variants, index);
}

function assetsFor(spec, index) {
  const id = orgId(spec.org);
  return {
    "brand-logo": {
      src: `./assets/${id}-logo.svg`,
      alt: `${spec.org} logo`,
      mediaType: "image/svg+xml",
    },
    "brand-logo-light": {
      src: `./assets/${id}-logo-light.svg`,
      alt: `${spec.org} light logo`,
      mediaType: "image/svg+xml",
    },
    "brand-icon": {
      src: `./assets/${id}-icon.svg`,
      alt: `${spec.org} icon`,
      mediaType: "image/svg+xml",
    },
    "cover-bg": {
      src: `./assets/${id}-cover-${(index % 5) + 1}.jpg`,
      alt: `${spec.area} background image`,
      mediaType: "image/jpeg",
    },
    "supporting-photo": {
      src: `./assets/${id}-field-photo.jpg`,
      alt: `${spec.area} field context`,
      mediaType: "image/jpeg",
    },
    "demo-video": {
      src: `./media/${id}-demo.mp4`,
      title: `${spec.area} walkthrough`,
      mediaType: "video/mp4",
    },
    "metric-data": {
      src: `./data/${slug(spec.title)}.csv`,
      format: "csv",
      title: `${spec.title} data`,
    },
    watermark: {
      src: `./assets/${id}-watermark.png`,
      alt: `${spec.org} watermark`,
      mediaType: "image/png",
    },
  };
}

function designFor(spec, index, catalogs, density) {
  const compact = density === "sparse";
  const base = {
    theme: pick(catalogs.themes, index),
    colorScheme: compact
      ? pick(catalogs.colorSchemes, index)
      : {
          id: pick(catalogs.colorSchemes, index),
          primary: color(index, 1),
          secondary: color(index, 2),
          accent: color(index, 3),
          background: index % 2 === 0 ? "#FFFFFF" : "#0B1220",
          text: index % 2 === 0 ? "#0F172A" : "#F8FAFC",
          custom: {
            signal: color(index, 5),
            risk: color(index, 4),
          },
        },
    fontScheme: compact
      ? pick(catalogs.fontSchemes, index)
      : {
          id: pick(catalogs.fontSchemes, index),
          heading: { family: "Aptos Display", weight: 700 },
          body: { family: "Aptos", weight: 400 },
          code: { family: "Consolas", weight: 400 },
        },
    dimensions: index % 9 === 0
      ? { preset: "16:10", widthInches: 13.333, heightInches: 8.333 }
      : pick(["widescreen", "16:9", "4:3", "16:10", "letter", "a4"], index),
    background: compact ? pick(["light1", "#FFFFFF", "dark1"], index) : backgroundFor(index),
    titleAlignment: pick(["left", "center", "right"], index),
    contentAlignment: pick(["left", "center", "right"], index, 1),
    contentBox: index % 3 === 0,
    contentDirection: pick(["horizontal", "vertical"], index),
    chartPrimary: pick(["none", "left", "right", "top", "bottom"], index),
    imageFill: pick(["crop", "fit"], index),
    listBullet: pick(["character", "image"], index),
  };

  if (compact) {
    return base;
  }

  return {
    ...base,
    logo: index % 4 === 0
      ? {
          default: "asset:brand-logo",
          light: "asset:brand-logo-light",
          icon: "asset:brand-icon",
          wordmark: "asset:brand-logo",
        }
      : "asset:brand-logo",
    watermark: index % 8 === 0 ? false : { src: "asset:watermark", opacity: 0.06 },
    header: index % 5 === 0
      ? false
      : {
          left: { section: true },
          right: { image: "asset:brand-icon" },
        },
    footer: {
      left: { organization: true },
      center: { text: index % 2 === 0 ? "Internal planning draft" : "Decision review" },
      right: { slideNumber: true },
    },
    slideImage: {
      src: "asset:cover-bg",
      position: pick(["background", "top", "bottom", "left", "right"], index),
    },
  };
}

function chartRows(index) {
  const base = 12 + (index % 17);
  return [
    ["Q1", base, base - 3],
    ["Q2", base + 4, base - 1],
    ["Q3", base + 7, base + 1],
    ["Q4", base + 11, base + 3],
  ];
}

function chartPayload(spec, index, catalogs, density) {
  const chartType = pick(catalogs.chartTypes, index);
  if (density === "dense" && index % 4 === 0) {
    return {
      type: chartType,
      data: {
        src: "asset:metric-data",
        sheet: "Summary",
        range: "A1:C8",
        columns: ["Quarter", "Current", "Baseline"],
      },
    };
  }
  return {
    type: chartType,
    data: {
      columns: ["Quarter", "Current", "Baseline"],
      rows: chartRows(index),
    },
  };
}

function tablePayload(spec, index) {
  return {
    columns: ["Workstream", "Owner", "Status", "Decision"],
    rows: [
      [spec.area, "Program lead", pick(["On track", "Watch", "At risk"], index), "Continue"],
      ["Data and reporting", "Analytics", pick(["On track", "Watch", "At risk"], index, 1), "Tighten metric definitions"],
      ["Field adoption", "Operations", pick(["On track", "Watch", "At risk"], index, 2), "Add weekly office hours"],
    ],
  };
}

function timelinePayload(spec, index) {
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  return {
    name: `${spec.area} execution path`,
    description: `Major milestones for ${spec.org}.`,
    events: [
      { when: pick(months, index), what: "Baseline", description: "Confirm current state, owners, and constraints." },
      { when: pick(months, index, 1), what: "Pilot", description: "Run a narrow pilot with visible success criteria." },
      { when: pick(months, index, 2), what: "Scale", description: "Expand the approach after risk review." },
      { when: pick(months, index, 3), what: "Embed", description: "Move reporting and routines into steady-state operations." },
    ],
  };
}

function languageFor(spec, index, catalogs, density) {
  const specific = [
    ["Japan", "japanese"],
    ["India", "english-in"],
    ["Brazil", "portuguese"],
    ["German", "german"],
    ["Arabic", "arabic"],
  ].find(([needle]) => spec.title.includes(needle));

  if (specific) {
    const id = specific[1];
    if (id === "arabic") {
      return {
        id,
        name: "Arabic",
        direction: "rtl",
        script: "Arab",
        fontScheme: "noto-sans-arabic",
        tags: ["international", "rtl"],
      };
    }
    return id;
  }

  if (spec.title.includes("Rural Payments")) return "english-in";
  if (spec.title.includes("Works Council")) return "german";
  if (spec.title.includes("Climate Adaptation")) return "portuguese";
  if (spec.title.includes("Market Entry")) return "japanese";

  if (density === "dense" && index % 11 === 0) {
    return {
      id: "english-us",
      name: "English (United States)",
      direction: "ltr",
      fontScheme: pick(catalogs.fontSchemes, index),
      tags: [spec.folder, slug(spec.area)],
    };
  }

  return pick(["english-us", "english-gb", "english-ca", "english-au"], index);
}

function richText(spec, index) {
  return [
    `${spec.org} should focus the next cycle on `,
    { text: spec.outcome.toLowerCase(), bold: true, color: color(index, 1) },
    ` while making the operating tradeoffs clear to ${spec.area.toLowerCase()} stakeholders.`,
  ];
}

function coverLayout(index) {
  return index % 2 === 0 ? "title-subtitle" : "title";
}

function textLayout(index) {
  return pick(["text-1x", "text-2x", "text-3x"], index);
}

function chartLayout(index) {
  return pick(["chart-1x", "chart-2x", "chart-3x"], index);
}

function listLayout(index) {
  return pick(["list-1x", "list-2x", "list-3x", "list-4x", "list-5x", "list-6x"], index);
}

function numberLayout(index) {
  return pick(["number-1x", "number-2x", "number-3x", "number-4x", "number-5x", "number-6x"], index);
}

function imageLayout(index) {
  return pick(["image-1x", "image-2x", "image-3x", "image-bleed"], index);
}

function promotedRegionSlide(spec, index, catalogs) {
  return {
    id: `s${index + 1}-regions`,
    section: "Operating model",
    layout: numberLayout(index),
    title: "Operating Model",
    "top:left": {
      metric: {
        value: metricValue(index),
        label: "Primary signal",
        description: spec.outcome,
        trend: trend(index),
      },
    },
    "top:center+right": {
      text: richText(spec, index),
    },
    "middle+bottom:left": {
      quote: {
        text: `The path is workable if we keep the metric simple and the decision owner visible.`,
        attribution: `${spec.area} working group`,
        source: "Stakeholder interview",
      },
    },
    "middle+bottom:center+right": {
      table: tablePayload(spec, index),
    },
    notes: "Use this slide to slow the conversation down around ownership and operating rhythm.",
  };
}

function blocksSlide(spec, index, catalogs) {
  return {
    id: `s${index + 1}-blocks`,
    section: "Evidence",
    layout: pick(["blank", "list-4x", "number-4x", "text-3x"], index),
    title: "Evidence Pack",
    blocks: [
      {
        chart: chartPayload(spec, index + 9, catalogs, "medium"),
      },
      {
        quote: {
          text: `Teams already know where the friction is; the deck makes the sequence of choices explicit.`,
          attribution: "Program sponsor",
          source: "Planning interview",
        },
      },
      {
        metric: evidenceMetric(index + 2),
      },
    ],
  };
}

function codeSlide(spec, index, catalogs) {
  return {
    id: `s${index + 1}-code`,
    section: "Appendix",
    layout: "code-1x",
    title: "Decision Rule",
    code: {
      source: [
        "const score = urgency * confidence;",
        "if (score >= threshold) {",
        "  routeToSponsor(workstream);",
        "} else {",
        "  keepInWeeklyReview(workstream);",
        "}",
      ].join("\n"),
      language: "ts",
      filename: `${slug(spec.title)}-rule.ts`,
    },
    hidden: index % 3 === 0,
  };
}

function mediaSlide(spec, index, catalogs) {
  if (index % 2 === 0) {
    return {
      id: `s${index + 1}-image`,
      section: "Context",
      layout: imageLayout(Math.floor(index / 2)),
      title: "Field Context",
      type: "image",
      image: {
        src: "asset:supporting-photo",
        alt: `${spec.area} context photo for ${spec.org}`,
        title: `${spec.area} context`,
      },
      notes: "Use the image as context, not decoration.",
    };
  }

  return {
    id: `s${index + 1}-video`,
    section: "Context",
    layout: "media-1x",
    title: "Demo Moment",
    type: "video",
    video: {
      src: "asset:demo-video",
      title: `${spec.area} walkthrough`,
      description: `Short clip demonstrating the proposed ${spec.area.toLowerCase()} workflow.`,
    },
  };
}

function slidesFor(spec, index, catalogs, density) {
  const slides = [
    {
      id: "s1",
      section: "Opening",
      layout: coverLayout(index),
      tag: spec.area,
      title: spec.title,
      subtitle: `${spec.org} ${spec.deckType}`,
      notes: `Open by naming the decision: ${spec.outcome}.`,
    },
    {
      id: "s2",
      section: "Context",
      layout: textLayout(index),
      title: "Why This Matters",
      text: richText(spec, index),
    },
    {
      id: "s3",
      section: "Evidence",
      layout: chartLayout(index),
      title: "Signal Trend",
      type: "chart",
      chart: chartPayload(spec, index, catalogs, density),
    },
  ];

  if (density === "sparse") {
    slides.push({
      id: "s4",
      section: "Next",
      layout: listLayout(index),
      title: "Next Steps",
      items: [
        `Agree on the owner for ${spec.area.toLowerCase()}.`,
        "Confirm the reporting cadence.",
        "Return with the first progress readout.",
      ],
    });
    return slides;
  }

  slides.push(
    {
      id: "s4",
      section: "Options",
      layout: "table-1x",
      title: "Decision Options",
      table: tablePayload(spec, index),
    },
    {
      id: "s5",
      section: "Plan",
      layout: index % 2 === 0 ? "text-2x" : "list-3x",
      title: "Execution Timeline",
      type: "timeline",
      timeline: timelinePayload(spec, index),
    },
  );

  if (density === "medium") {
    slides.push({
      id: "s6",
      section: "Close",
      layout: listLayout(index + 2),
      title: "The Ask",
      bullets: [
        { text: `Approve the next milestone for ${spec.outcome.toLowerCase()}.`, level: 0 },
        { text: "Assign an executive sponsor and one accountable owner.", level: 0 },
        { text: "Review progress in the next operating meeting.", level: 0 },
      ],
    });
    return slides;
  }

  slides.push(
    promotedRegionSlide(spec, index, catalogs),
    blocksSlide(spec, index, catalogs),
    mediaSlide(spec, index, catalogs),
    codeSlide(spec, index, catalogs),
    {
      id: "s10",
      section: "Close",
      layout: listLayout(index + 3),
      title: "Decision and Follow Through",
      items: [
        ["Commit to ", { text: spec.outcome.toLowerCase(), bold: true }],
        { text: "Name the sponsor and operating owner.", description: "Keep one person accountable for momentum." },
        { text: "Publish the progress rhythm.", description: "Use the same metric definitions every week." },
        { text: "Return with proof.", description: "Bring customer, employee, resident, or learner evidence into the next review." },
      ],
    },
  );

  return slides;
}

function catalogOverrides(spec, index, catalogs) {
  const customId = `${slug(spec.title)}-arc`;
  return {
    narratives: {
      source: [
        "pkg:@openpresentation/gallery/narratives",
        "https://www.pptx.gallery/narratives",
      ],
      records: [
        {
          $schema: "https://openpresentation.org/schema/opf-narrative/v1",
          id: customId,
          name: `${titleCase(spec.area)} Decision Arc`,
          summary: `A custom arc for ${spec.org}.`,
          beats: [
            { id: "context", name: "Context", slideType: "text", layoutHint: "text-1x" },
            { id: "evidence", name: "Evidence", slideType: "chart", layoutHint: "chart-1x" },
            { id: "decision", name: "Decision", slideType: "list", layoutHint: "list-3x" },
          ],
        },
      ],
    },
    themes: {
      records: [
        {
          $schema: "https://openpresentation.org/schema/opf-theme/v1",
          id: `${slug(spec.org)}-theme`,
          name: `${spec.org} Working Theme`,
          colorScheme: pick(catalogs.colorSchemes, index),
          fontScheme: pick(catalogs.fontSchemes, index),
          background: pick(["light1", "dark1", "#F8FAFC"], index),
          tags: [slug(spec.area), "example"],
        },
      ],
    },
    colorSchemes: {
      source: "https://www.pptx.gallery/color-schemes",
      records: [
        {
          $schema: "https://openpresentation.org/schema/opf-color-scheme/v1",
          id: `${slug(spec.org)}-signal`,
          name: `${spec.org} Signal Palette`,
          accent1: color(index, 1),
          accent2: color(index, 2),
          accent3: color(index, 3),
          accent4: color(index, 4),
          accent5: color(index, 5),
          accent6: color(index, 6),
          dark1: "#0F172A",
          dark2: "#334155",
          light1: "#FFFFFF",
          light2: "#F8FAFC",
          hyperlink: "#2563EB",
          followedHyperlink: "#7C3AED",
        },
      ],
    },
    fontSchemes: {
      source: "pkg:@openpresentation/gallery/font-schemes",
    },
    layouts: {
      source: "https://www.pptx.gallery/layouts",
    },
    chartTypes: {
      source: "https://www.pptx.gallery/chart-types",
    },
    languages: {
      source: "https://www.pptx.gallery/languages",
    },
    audiences: {
      source: "https://www.pptx.gallery/audiences",
    },
    purposes: {
      source: "https://www.pptx.gallery/purposes",
    },
    tones: {
      source: "https://www.pptx.gallery/tones",
    },
    socialPlatforms: {
      source: "https://www.pptx.gallery/social-platforms",
    },
  };
}

function densityFor(index) {
  const position = index % 10;
  if (position < 2) return "sparse";
  if (position < 6) return "medium";
  return "dense";
}

function deckFor(rawSpec, index, catalogs) {
  const [folder, title, org, area, outcome] = rawSpec;
  const density = densityFor(index);
  const orgSlug = orgId(org);
  const socialOne = pick(catalogs.socialPlatforms, index);
  const socialTwo = pick(catalogs.socialPlatforms, index, 3);
  const audienceOne = pick(catalogs.audiences, index);
  const audienceTwo = pick(catalogs.audiences, index, 4);
  const purpose = pick(catalogs.purposes, index);
  const tone = pick(catalogs.tones, index);
  const language = pick(catalogs.languages, index);
  const narrative = pick(catalogs.narratives, index);
  const spec = {
    folder,
    title,
    org,
    area,
    outcome,
    deckType: area,
  };

  const deck = density === "sparse" ? {
    name: title,
    language: languageFor(spec, index, catalogs, density),
    audience: density === "sparse"
      ? [audienceOne]
      : [
          audienceOne,
          {
            id: audienceTwo,
            attentionBudgetMinutes: 18 + (index % 18),
            technicalFluency: pick(["low", "medium", "high", "mixed"], index),
            decisionPower: pick(["informational", "advisory", "decision-maker"], index),
            recommendedNarratives: [narrative],
            recommendedTones: [tone],
          },
        ],
    purpose: density === "sparse"
      ? purpose
      : {
          id: purpose,
          outcome,
          successCriteria: [
            "The audience can state the decision in one sentence.",
            "The owner and next checkpoint are explicit.",
          ],
        },
    tone: density === "sparse"
      ? tone
      : {
          id: tone,
          voiceCues: [
            "Make the decision visible.",
            "Use concrete operating language.",
          ],
          avoid: [
            "Do not bury the ask.",
            "Do not over-explain obvious context.",
          ],
        },
    narrative: density === "dense"
      ? {
          id: narrative,
          description: `${title} uses a compact evidence-to-decision arc for ${org}.`,
          beats: [
            { id: "context", name: "Context", slideType: "text", layoutHint: "text-1x" },
            { id: "evidence", name: "Evidence", slideType: "chart", layoutHint: "chart-1x" },
            { id: "commitment", name: "Commitment", slideType: "list", layoutHint: "list-3x" },
          ],
        }
      : narrative,
    design: designFor(spec, index, catalogs, density),
    slides: slidesFor(spec, index, catalogs, density),
  } : {
    $schema: schemaId,
    name: title,
    description: `${title} is a fictional OPF example for ${area.toLowerCase()} teams. It demonstrates a realistic presentation structure with catalog-backed design and content payloads.`,
    filename: slug(title),
    language: languageFor(spec, index, catalogs, density),
    audience: [
      audienceOne,
      {
        id: audienceTwo,
        attentionBudgetMinutes: 18 + (index % 18),
        technicalFluency: pick(["low", "medium", "high", "mixed"], index),
        decisionPower: pick(["informational", "advisory", "decision-maker"], index),
        recommendedNarratives: [narrative],
        recommendedTones: [tone],
      },
    ],
    purpose: {
      id: purpose,
      outcome,
      successCriteria: [
        "The audience can state the decision in one sentence.",
        "The owner and next checkpoint are explicit.",
      ],
    },
    tone: {
      id: tone,
      voiceCues: [
        "Make the decision visible.",
        "Use concrete operating language.",
      ],
      avoid: [
        "Do not bury the ask.",
        "Do not over-explain obvious context.",
      ],
    },
    narrative: density === "dense"
      ? {
          id: narrative,
          description: `${title} uses a compact evidence-to-decision arc for ${org}.`,
          beats: [
            { id: "context", name: "Context", slideType: "text", layoutHint: "text-1x" },
            { id: "evidence", name: "Evidence", slideType: "chart", layoutHint: "chart-1x" },
            { id: "commitment", name: "Commitment", slideType: "list", layoutHint: "list-3x" },
          ],
        }
      : narrative,
    design: designFor(spec, index, catalogs, density),
    slides: slidesFor(spec, index, catalogs, density),
  };

  if (density !== "sparse") {
    deck.organization = index % 7 === 0
      ? [
          {
            id: orgSlug,
            name: org,
            logo: "asset:brand-logo",
            domain: orgDomain(org),
            email: `hello@${orgDomain(org)}`,
            tagline: outcome,
            role: "primary",
            socials: {
              [socialOne]: `@${orgSlug}`,
            },
          },
          {
            id: `${orgSlug}-partner`,
            name: `${titleCase(area)} Partner Office`,
            role: "partner",
            domain: `partner-${orgDomain(org)}`,
          },
        ]
      : {
          id: orgSlug,
          name: org,
          legalName: legalNameFor(spec),
          logo: "asset:brand-logo",
          domain: orgDomain(org),
          email: `hello@${orgDomain(org)}`,
          phone: `+1555${String(1000000 + index).slice(0, 7)}`,
          tagline: outcome,
          role: "primary",
          socials: {
            [socialOne]: `@${orgSlug}`,
            [socialTwo]: `https://${socialTwo}.example/${orgSlug}`,
          },
        };
    deck.speaker = index % 6 === 0
      ? [
          {
            id: "maya",
            name: "Maya Chen",
            title: "Program Sponsor",
            photo: "asset:supporting-photo",
            email: `maya@${orgDomain(org)}`,
            organizationId: orgSlug,
            socials: { [socialOne]: "@maya-chen" },
          },
          {
            id: "jon",
            name: "Jon Alvarez",
            title: "Operating Lead",
            organizationId: orgSlug,
            socials: { [socialTwo]: "@jon-alvarez" },
          },
        ]
      : {
          id: "speaker",
          name: pick(["Maya Chen", "Jon Alvarez", "Priya Raman", "Samira Okafor", "Evan Brooks"], index),
          title: pick(["Program Sponsor", "Operating Lead", "Director of Strategy", "Chief of Staff", "Product Lead"], index),
          organizationId: orgSlug,
          bio: `Leads ${area.toLowerCase()} planning for ${org}.`,
          socials: { [socialOne]: `@${orgSlug}-speaker` },
        };
    deck.author = index % 4 === 0 ? ["OPF Example Generator", "Open Presentation"] : "OPF Example Generator";
    deck.takeaway = index % 3 === 0
      ? [outcome, "The next decision and owner should be visible on the final slide."]
      : outcome;
    deck.duration = 8 + (index % 25);
    deck.tags = [folder, slug(area), slug(purpose), slug(tone), density];
    deck.assets = assetsFor(spec, index);
    deck.extensions = {
      example: {
        folder,
        density,
        scenario: slug(title),
        generatedBy: "scripts/generate-example-suite.mjs",
      },
    };
  }

  if (density === "dense") {
    deck.catalogs = catalogOverrides(spec, index, catalogs);
  }

  return { deck, folder, filename: `${slug(title)}.opf.json` };
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeReadme() {
  const readme = `# OPF Example Gallery

This folder contains broader OPF examples organized by scenario instead of by isolated schema feature.

- \`industries/\`: vertical market and operating model examples.
- \`business-functions/\`: department and function-specific decks.
- \`education/\`: K-12, higher education, research, and workforce learning examples.
- \`government/\`: public-sector, civic, regulator, and public engagement examples.
- \`presentation-types/\`: common deck shapes such as pitches, QBRs, training, incident reviews, and reports.
- \`international/\`: multilingual or region-specific examples.
- \`design-and-media/\`: examples that stress design, image, video, and data-storytelling choices.

The root-level examples one directory up remain compact regression fixtures. The gallery examples are intentionally more varied: some are sparse OPF documents, while others use catalog overrides, assets, metadata, promoted regions, blocks, and richer design configuration.
`;
  await mkdir(examplesRoot, { recursive: true });
  await writeFile(path.join(examplesRoot, "README.md"), readme, "utf8");
}

async function main() {
  const catalogs = Object.fromEntries(
    await Promise.all(
      Object.entries(catalogKinds).map(async ([name, kind]) => [name, await loadCatalogIds(kind)]),
    ),
  );

  await writeReadme();

  for (let index = 0; index < scenarioSpecs.length; index += 1) {
    const { deck, folder, filename } = deckFor(scenarioSpecs[index], index, catalogs);
    await writeJson(path.join(examplesRoot, folder, filename), deck);

    if ((index + 1) % 10 === 0) {
      // Private checkpoint hook: keep output generic so coverage stats do not enter repo logs or docs.
      console.log(`generated ${index + 1} examples`);
    }
  }

  console.log(`wrote ${scenarioSpecs.length} OPF gallery examples`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
