import { supabase } from "../lib/supabase";


export default async function addXP(userId, amount) {


  const { data: profile, error } = await supabase

    .from("users")

    .select("xp")

    .eq("id", userId)

    .single();



  if(error){

    console.error("XP FETCH ERROR:", error);

    return null;

  }



  const newXP = profile.xp + amount;



  const { data, error: updateError } = await supabase

    .from("users")

    .update({

      xp: newXP

    })

    .eq("id", userId)

    .select()

    .single();



  if(updateError){

    console.error("XP UPDATE ERROR:", updateError);

    return null;

  }



  return data;

}