window.MODULES = {
  "alarm-clock": {
    title: "Alarm clock",
    summary: "Build and run a pipeline in five minutes.",
    duration: 5,
    notebook: "modules/alarm-clock/alarm-clock.ipynb",
    requires: ["python"],
  },
  "notepad-integration": {
    title: "Integrate RocketRide into an existing app",
    summary: "Add a pipeline to a TypeScript notepad app with the TS SDK.",
    duration: 15,
    notebook: "modules/notepad-integration/notepad-integration.ipynb",
    requires: ["python", "node", "pnpm", "git"],
  },
  "app-build": {
    title: "Build and deploy an app",
    summary: "Build a simple app from scratch and deploy it to RocketRide Cloud.",
    duration: 40,
    notebook: "modules/app-build/app-build.ipynb",
    requires: ["python"],
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
    modules: ["alarm-clock", "notepad-integration", "app-build"],
  },
];
