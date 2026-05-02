import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;

      if (userId) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ 
            is_pro: true,
            stripe_customer_id: session.customer as string 
          })
          .eq("id", userId);

        if (error) console.error("Error updating profile:", error);
      }
      break;
    
    case "customer.subscription.deleted":
      const subscription = event.data.object as Stripe.Subscription;
      const { error: deleteError } = await supabaseAdmin
        .from("profiles")
        .update({ is_pro: false })
        .eq("stripe_customer_id", subscription.customer as string);
      
      if (deleteError) console.error("Error revoking pro status:", deleteError);
      break;
  }

  return NextResponse.json({ received: true });
}
