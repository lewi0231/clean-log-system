import { serve } from "server";
import { extractAuthToken, getAuthUser } from "../_utils/auth.ts";
import {
  errorResponse,
  extractErrorMessage,
  getErrorStatusCode,
  handleCors,
  jsonResponse,
} from "../_utils/http.ts";
import { createLogger } from "../_utils/logger.ts";
import { createServiceRoleClient } from "../_utils/supabase.ts";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const logger = createLogger(req, {
    functionName: "upload-organization-logo",
  });

  try {
    // Get auth token from headers
    const token = extractAuthToken(req);

    if (!token) {
      logger.warn("Missing authentication token for logo upload");
      return errorResponse("Authentication required", 401);
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify token and get user
    const authUser = await getAuthUser(token);

    if (!authUser || !authUser.email) {
      logger.warn("User not found for logo upload", {
        has_auth_user: !!authUser,
      });
      return errorResponse("User not found", 401);
    }

    // Get organization_id from organization_user table
    const { data: orgUser, error: orgUserError } = await supabaseAdmin
      .from("organization_user")
      .select("organization_id")
      .eq("email", authUser.email)
      .maybeSingle();

    if (orgUserError || !orgUser) {
      logger.warn("Organization not found for user", {
        error: orgUserError,
        user_email: authUser.email,
      });
      return errorResponse("Organization not found for user", 404);
    }

    const organizationId = orgUser.organization_id;

    // Parse request body
    const body = await req.json();
    const { file_name, file_type, file_data, update_organization } = body;

    if (!file_name || !file_type || !file_data) {
      logger.warn("Missing required fields for logo upload", {
        has_file_name: !!file_name,
        has_file_type: !!file_type,
        has_file_data: !!file_data,
      });
      return errorResponse("File name, type, and data are required", 400);
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file_type)) {
      logger.warn("Invalid file type for logo upload", { file_type });
      return errorResponse(
        "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed",
        400,
      );
    }

    // Decode base64 file data
    const binaryString = atob(file_data);
    const fileBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      fileBytes[i] = binaryString.charCodeAt(i);
    }

    // Validate file size
    if (fileBytes.length > MAX_FILE_SIZE) {
      logger.warn("File size exceeds limit for logo upload", {
        file_size: fileBytes.length,
        max_size: MAX_FILE_SIZE,
      });
      return errorResponse("File size exceeds 5MB limit", 400);
    }

    // Generate unique filename
    const fileExt = file_name.split(".").pop() || "jpg";
    const fileName = `${organizationId}/${Date.now()}.${fileExt}`;

    // Upload to storage bucket
    const { data: _uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from("organization-logos")
      .upload(fileName, fileBytes, {
        cacheControl: "3600",
        upsert: true, // Replace if exists
        contentType: file_type,
      });

    if (uploadError) {
      logger.error("Storage upload error", uploadError, {
        organization_id: organizationId,
        file_name: fileName,
      });
      return errorResponse("Failed to upload file", 500);
    }

    // Construct public URL manually using SUPABASE_URL (avoids internal Docker hostnames)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      return errorResponse("SUPABASE_URL not configured", 500);
    }

    let normalizedUrl = supabaseUrl;

    if (supabaseUrl.includes("kong:8000") || supabaseUrl.includes("kong")) {
      normalizedUrl = supabaseUrl.replace(
        /http:\/\/kong:8000/,
        "http://127.0.0.1:54321",
      );
    }
    // Remove trailing slash if present
    const baseUrl = normalizedUrl.replace(/\/$/, "");
    const publicUrl =
      `${baseUrl}/storage/v1/object/public/organization-logos/${fileName}`;

    // Optionally update organization logo_url if requested
    const shouldUpdateOrg = update_organization === true;

    if (shouldUpdateOrg) {
      const { error: updateError } = await supabaseAdmin
        .from("organization")
        .update({ logo_url: publicUrl })
        .eq("id", organizationId);

      if (updateError) {
        logger.error("Failed to update organization logo_url", updateError, {
          organization_id: organizationId,
          logo_url: publicUrl,
        });
        // Still return the URL even if update fails
      }
    }

    logger.info("Organization logo uploaded successfully", {
      organization_id: organizationId,
      file_name: fileName,
      logo_url: publicUrl,
      updated_organization: shouldUpdateOrg,
    });

    return jsonResponse({
      success: true,
      logo_url: publicUrl,
      file_name: fileName,
    });
  } catch (error) {
    logger.error("Upload organization logo error", error);
    return errorResponse(
      extractErrorMessage(error, "Failed to upload logo"),
      getErrorStatusCode(error),
    );
  }
});
