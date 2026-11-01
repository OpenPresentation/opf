// The deck every chrome example opens: three slides, a name, the Roboto font scheme (so the page loads one family).
export const deck = {
  name: "Quarterly review",
  language: "en-US",
  design: { theme: "classic", fontScheme: "roboto" },
  slides: [
    {
      id: "intro",
      title: "Revenue grew 34% this quarter",
      subtitle: "Every region beat its plan",
      composition: { mode: "row", weights: [3, 2] },
      blocks: [
        { id: "story", text: "Enterprise led the growth, and the new self-serve plan brought in a third of the new accounts." },
        { id: "kpi", metric: { value: "34%", label: "Year over year" } },
      ],
    },
    {
      id: "evidence",
      title: "Where the growth came from",
      composition: { mode: "row" },
      blocks: [
        { id: "chart", chart: { type: "column", data: { columns: ["Region", "Revenue"], rows: [["North", 42], ["South", 31], ["West", 27]] } } },
        { id: "notes", items: ["North: two large renewals", "South: partner channel doubled", "West: the pipeline to watch"] },
      ],
    },
    {
      id: "plan",
      title: "Next quarter",
      layout: "two-column",
      blocks: [
        { id: "hire", text: "Hire two account executives for the West." },
        { id: "ship", items: ["Ship the analytics add-on", "Open the Berlin office"] },
      ],
    },
  ],
};
