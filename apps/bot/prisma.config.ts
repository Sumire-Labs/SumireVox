import { defineConfig } from 'prisma/config';

// dotenv-cli loads the root .env for local commands; containers supply the environment.
// Generation/validation must work without a database or deployment credentials.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
