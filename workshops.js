window.MODULES = {
  kanban: {
    title: "Kanban board",
    summary:
      "From an empty folder to a deployed app in 5 minutes: two commands, a kanban to-do board built by Claude Code, and one command to deploy it to RocketRide Cloud.",
    duration: 5,
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
    duration: 40,
    notebook: "modules/specter-mutual/specter-mutual.ipynb",
    download: false,
    guide: "modules/specter-mutual/index.html",
    requires: ["python", "node", "pnpm"],
  },
};

window.WORKSHOPS = [
  {
    id: "zero-to-agent",
    title: "Zero to Agent",
    summary:
      "Ship your first RocketRide pipeline, integrate one into a real app, then build and deploy your own.",
    funnel: "cloud", // cloud | local
    status: "live", // live | draft
    modules: ["kanban", "excalidraw-integration", "specter-mutual"],
  },
];
