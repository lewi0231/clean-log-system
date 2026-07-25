# Database Coding Practices

This document outlines coding practices and standards for the database directory, including Supabase Edge Functions and migrations.

## Supabase Edge Functions

### Creating New Edge Functions

**CRITICAL: Always create a `deno.json` file** when creating a new edge function. This file is required for Deno to resolve imports correctly.

#### Required Files Structure

```
database/supabase/functions/your-function-name/
  ├── index.ts
  └── deno.json  ← REQUIRED - Do not forget this!
```

#### Standard `deno.json` Template

Every edge function must have a `deno.json` file with the following content:

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@2",
    "server": "https://deno.land/std@0.168.0/http/server.ts",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2.49.1",
    "dotenv": "jsr:@std/dotenv"
  },
  "compilerOptions": {
    "lib": ["deno.window"],
    "strict": true
  }
}
```

#### Common Imports Pattern

All edge functions should follow this import pattern:

```typescript
import { serve } from "server";
import { verifyOrganizationMembershipFromRequest } from "../_utils/auth.ts";
import { errorResponse, handleCors, jsonResponse } from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";
```

### Error Handling

- Always use `handleCors` first in your function
- Use `errorResponse` and `jsonResponse` from `_utils/http.ts` for consistent responses
- Use `createLogger` for logging (not `console.log` for production code)
- Always wrap main logic in try-catch blocks

### Authentication & Authorization

- Use `verifyOrganizationMembershipFromRequest` to verify user access
- Use `getOrganizationIdFromUser` to get organization ID from request
- Use `createServiceRoleClient` for database operations (not the regular client)

### Database Migrations

- Migration files should be named with timestamp prefix: `YYYYMMDDHHMMSS_description.sql`
- Always use `IF NOT EXISTS` for safety when adding columns
- Include comments for documentation
- Test migrations on local Supabase before deploying

## Common Patterns

### Request Body Parsing

```typescript
const body = await req.json();
const validation = validateRequiredFields(body, ["required_field"]);
if (!validation.valid) {
  return errorResponse("Missing required fields", 400);
}
```

### Database Queries

```typescript
const supabase = createServiceRoleClient();
const { data, error } = await supabase
  .from("table_name")
  .select("columns")
  .eq("field", value)
  .maybeSingle(); // or .single() if you expect exactly one result
```

## GitHub Issue Management

- **Always use `gh issue create` command** to create GitHub issues
- Preferred format: `gh issue create --title "Title" --body-file .github/ISSUE_TEMPLATE/issue-name.md`
- This ensures consistent issue formatting and documentation

### Standard Labels

Use **only** these label options (they match GitHub’s common defaults and avoid CLI failures when a label doesn’t exist):

- `bug`
- `documentation`
- `duplicate`
- `enhancement`
- `good first issue`
- `help wanted`
- `invalid`
- `question`
- `wontfix`

If a label doesn’t exist in the repo yet, **omit `--label`** (don’t guess), or create the label explicitly first.

## Checklist for New Edge Functions

- [ ] Created `deno.json` file with standard imports
- [ ] Added CORS handling with `handleCors`
- [ ] Added authentication/authorization checks
- [ ] Used proper error handling with try-catch
- [ ] Used `createLogger` for logging
- [ ] Used `errorResponse` and `jsonResponse` for responses
- [ ] Tested locally before deploying
