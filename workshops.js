window.MODULES = {
  "alarm-clock": {
    title: "Alarm clock",
    summary: "Build an analog alarm clock app and deploy it to RocketRide Cloud.",
    duration: 5,
    notebook: "modules/alarm-clock/alarm-clock.ipynb",
    guide: "modules/alarm-clock/index.html",
    requires: ["python"],
  },
  "notepad-integration": {
    title: "Integrate RocketRide into an existing app",
    summary: "Add a pipeline to a TypeScript notepad app with the TS SDK.",
    duration: 15,
    notebook: "modules/notepad-integration/notepad-integration.ipynb",
    guide: "modules/notepad-integration/index.html",
    requires: ["python", "node", "pnpm", "git"],
  },
  "specter-mutual": {
    title: "Specter Mutual: zero to a deployed app",
    summary:
      "Build an AI claims reviewer from nothing: an agent that decides, a policy engine that holds it to the rules, and a portal deployed to your workspace.",
    duration: 40,
    notebook: "modules/specter-mutual/specter-mutual.ipynb",
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
    modules: ["alarm-clock", "notepad-integration", "specter-mutual"],
  },
];
