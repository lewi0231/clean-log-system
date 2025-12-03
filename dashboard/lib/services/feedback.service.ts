import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type {
    ListFeedbackRequest,
    ListFeedbackResponse,
} from "@/lib/types/api";

export class FeedbackService {
    /**
     * List feedback for an organization
     */
    static async list(
        request: ListFeedbackRequest,
    ): Promise<ListFeedbackResponse> {
        try {
            log.debug("FeedbackService: Fetching feedback", {
                organizationId: request.organization_id,
            });

            const { data, error } = await supabase.functions.invoke(
                "list-feedback",
                {
                    body: request,
                },
            );

            if (error) {
                throw error;
            }

            if (!data || !data.success) {
                throw new Error("Failed to fetch feedback");
            }

            log.info("FeedbackService: Feedback fetched successfully", {
                feedbackCount: data.feedback?.length || 0,
            });
            return data as ListFeedbackResponse;
        } catch (err) {
            log.error("FeedbackService: Failed to fetch feedback", {
                error: err instanceof Error ? err.message : "Unknown error",
            });
            throw err;
        }
    }
}
