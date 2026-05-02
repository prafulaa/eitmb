const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  "https://sylzyfxbgyixsospoaws.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bHp5ZnhiZ3lpeHNvc3BvYXdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc0NTQyOSwiZXhwIjoyMDkzMzIxNDI5fQ.XSNeNtbf0e-mrf_Rf_BCTyvY2qN1pG4-yqFNadrJac8"
);

async function checkProfile() {
  const { data, error } = await supabaseAdmin.from("profiles").select("*");
  console.log("Profiles:", data);
  console.log("Error:", error);
}

checkProfile();
