import { loadEnv } from "./config/env.js";
import { createApp } from "./app.js";
import { startReminderWorker } from "./workers/reminderWorker.js";

const env = loadEnv();
const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(`SiroMan API listening on http://localhost:${env.PORT}`);
  startReminderWorker();
});
