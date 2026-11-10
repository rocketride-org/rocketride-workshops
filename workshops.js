window.MODULES = {
  kanban: {
    title: "Kanban board",
    summary:
      "From an empty folder to a deployed app in 10 minutes: a kanban to-do board built by Claude Code, deployed to RocketRide Cloud with one command.",
    duration: 10,
    guide: "modules/kanban/index.html",
    github: "modules/kanban",
    requires: ["node", "pnpm"],
  },
  "notepad-integration": {
    title: "Integrate RocketRide into an existing app",
    summary: "Clone a TypeScript notepad app and paste in an AI Assist button backed by a RocketRide pipeline.",
    duration: 15,
    guide: "modules/notepad-integration/index.html",
    requires: ["python", "node", "pnpm", "git"],
  },
  "excalidraw-integration": {
    title: "Give Excalidraw a diagram agent",
    summary:
      "Clone Excalidraw and add a RocketRide agent to its sidebar that reads a GitHub repo and draws its architecture.",
    duration: 15,
    guide: "modules/excalidraw-integration/index.html",
    github: "modules/excalidraw-integration",
    requires: ["node", "yarn", "git"],
  },
  "specter-mutual": {
    title: "Specter Mutual: zero to a deployed app",
    summary:
      "Build an AI claims reviewer from nothing: an agent that decides, a policy engine that holds it to the rules, and a portal deployed to your workspace.",
    duration: 32,
    notebook: "modules/specter-mutual/specter-mutual.ipynb",
    download: false,
    guide: "modules/specter-mutual/index.html",
    requires: ["node", "pnpm"],
  },
};

window.WORKSHOPS = [
  {
    id: "zero-to-agent",
    title: "Zero to Agent",
    summary:
      "Deploy your first app, put a RocketRide agent inside a real app, then build and deploy an agent of your own.",
    funnel: "cloud", // cloud | local
    feedbackMinutes: 3, // reserved at the end of the hour, after the last project
    status: "live", // live | draft
    modules: ["kanban", "excalidraw-integration", "specter-mutual"],
  },
];
