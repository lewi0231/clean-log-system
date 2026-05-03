/**
 * Lists form sections for an org. Future (multi–line of business): optional `line_of_business_id`
 * in the request body should filter `form_section` the same way as field configs.
 */
import { serveJsonHandler } from "../_utils/handler-pipeline.ts";
import { jsonResponse } from "../_utils/http.ts";
import { listFormSectionsBodySchema } from "../_utils/zod-schemas.ts";

serveJsonHandler({
  name: "list-form-sections",
  schema: listFormSectionsBodySchema,
  preset: "secured",
  securedClientMode: "membership",
  run: async ({ supabase, auth, correlationId }) => {
    const { data: sections, error: sectionsError } = await supabase
      .from("form_section")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .order("order_position", { ascending: true });

    if (sectionsError) throw sectionsError;

    return jsonResponse({ success: true, sections: sections || [] }, 200, undefined, correlationId);
  },
});
