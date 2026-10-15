# Alarm clock

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/alarm-clock/>

The first and fastest module. Attendees start a RocketRide project by hand, the way they would at work, and ask Claude Code for an analog alarm clock app: a ticking face, a time picker and an alarm that flashes and beeps. They watch it in the App Builder's preview, then deploy and publish it from the App Builder to their own desktop on cloud.rocketride.ai.

```sh
pip install rocketride
rocketride init --uri https://api.rocketride.ai
rocketride app create alarm_clock --name "Alarm Clock" --developer <your developer id>
claude
```

**Time:** 15 minutes

**Requires:** Python 3.10+, Node 20+ and pnpm 10+ (the App Builder's preview runs the app locally), the RocketRide extension, a RocketRide Cloud account, a developer id for the organization (claimed once in the App Builder's Deploy tab), and [Claude Code](https://claude.com/claude-code).

**The notebook:** [`alarm-clock.ipynb`](alarm-clock.ipynb) is only the fallback. Its one cell writes a finished clock into `apps/alarm_clock` for anyone without Claude Code or whose clock won't compile. Install, init, app creation and deploy are never scripted: attendees do them by hand from the guide.
