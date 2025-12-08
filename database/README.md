# Supabase

## Running Locally

```
<!-- This starts the local instance-->
supabase start

<!-- This stops the local instance -->
supabase stop

<!-- This updates the local server with the migration -->
supabase migration up

<!-- Logs you into remote supabase -->
supabase link
```

## Run Tests

`deno test --allow-all database/supabase/functions/_utils/__tests__/invoice-email.test.ts`
