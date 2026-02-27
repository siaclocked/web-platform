import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const {
      email,
      firstName,
      lastName,
      phone,
      positionIds,
      placeIds,
      hourlyRate,
      positionRatings,
      start_date,
    } = await request.json();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Create service role client to bypass RLS and use admin methods
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get manager's company
    const { data: manager } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!manager || !manager.company_id) {
      return NextResponse.json(
        { error: "Manager not found or has no company" },
        { status: 404 },
      );
    }

    // Create worker account with email (no password - they'll use OTP)
    const { data: authData, error: createAuthError } =
      await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        email_confirm: true,
        user_metadata: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone?.trim() || null,
        },
      });

    if (createAuthError) throw createAuthError;

    if (!authData.user) throw new Error("Failed to create worker account");

    // Create user profile (without position_id since we use worker_skills)
    const profileData: Record<string, any> = {
      id: authData.user.id,
      company_id: manager.company_id,
      email: email.trim().toLowerCase(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone?.trim() || null,
      role: "worker",
      is_active: true,
      status: "ACTIVE",
      manager_id: user.id,
      hourly_rate: hourlyRate || null,
    };

    if (start_date) profileData.start_date = start_date;

    const { error: profileError } = await supabase.from("users").insert(profileData);

    if (profileError) {
      // Rollback: delete the auth user we just created since profile insert failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    // Add worker positions (using worker_skills table - positions are stored as skills)
    if (positionIds && positionIds.length > 0) {
      const skillInserts = positionIds.map((positionId: string) => ({
        worker_id: authData.user.id,
        skill_id: positionId,
        rating: positionRatings?.[positionId] ?? 5,
      }));

      const { error: skillsError } = await supabase
        .from("worker_skills")
        .insert(skillInserts);

      if (skillsError) {
        console.error("Error adding worker skills:", skillsError);
      }
    }

    // Add worker places
    if (placeIds && placeIds.length > 0) {
      const placeInserts = placeIds.map((placeId: string) => ({
        worker_id: authData.user.id,
        place_id: placeId,
        is_active: true,
      }));

      const { error: placesError } = await supabase
        .from("worker_places")
        .insert(placeInserts);

      if (placesError) {
        console.error("Error adding worker places:", placesError);
      }
    }

    console.log("Worker created successfully:", {
      userId: authData.user.id,
      email,
      companyId: manager.company_id,
      positions: positionIds?.length || 0,
      places: placeIds?.length || 0,
    });

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
    });
  } catch (err: any) {
    console.error("Error creating worker:", err);

    // Provide user-friendly error messages for common issues
    let message = "Failed to create worker account";
    let status = 500;

    const errMsg = err?.message || err?.code || "";
    if (errMsg.includes("duplicate") && errMsg.includes("phone")) {
      message = "A user with this phone number already exists.";
      status = 409;
    } else if (errMsg.includes("duplicate") && errMsg.includes("email")) {
      message = "A user with this email already exists.";
      status = 409;
    } else if (
      errMsg.includes("already been registered") ||
      errMsg.includes("already exists")
    ) {
      message = "A user with this email already exists.";
      status = 409;
    } else if (err instanceof Error) {
      message = err.message;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
