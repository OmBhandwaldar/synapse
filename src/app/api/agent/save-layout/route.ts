import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { connections } = await req.json();

    if (!connections || !Array.isArray(connections)) {
      return NextResponse.json(
        { error: "Invalid connections array" },
        { status: 400 }
      );
    }

    // Perform updates for each agent connection setup
    const updatePromises = connections.map(async (conn) => {
      const { agentAddress, ownerAddress, skills } = conn;

      if (!agentAddress) return;

      const skill1 = skills && skills[0] !== undefined ? String(skills[0]) : null;
      const skill2 = skills && skills[1] !== undefined ? String(skills[1]) : null;
      const skill3 = skills && skills[2] !== undefined ? String(skills[2]) : null;

      const { error } = await supabase
        .from("agents")
        .update({
          owner_address: ownerAddress || null,
          equipped_skill_1: skill1,
          equipped_skill_2: skill2,
          equipped_skill_3: skill3,
        })
        .eq("agent_address", agentAddress);

      if (error) {
        console.error(`Error updating agent ${agentAddress}:`, error);
        throw error;
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, message: "Swarm layout saved successfully" });
  } catch (err: any) {
    console.error("Save layout error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save swarm layout" },
      { status: 500 }
    );
  }
}
