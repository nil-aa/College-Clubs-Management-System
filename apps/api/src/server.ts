import 'dotenv/config';
import { loadConfig } from './shared/config/index.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp({ config });
app.listen(config.API_PORT, () => {
  console.log(`Club Management API listening on http://localhost:${config.API_PORT}`);
});
