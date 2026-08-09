import tiers from "../data/tiers";


function calculateTradeXP(received, offered) {


  const receivedTier =
    tiers[received.tier] || 1;


  const receivedValue =
    received.value;



  let xp = 0;



  // Base XP from rarity

  xp += receivedTier * 25;



  // Value scaling

  xp += Math.floor(
    receivedValue / 10
  );



  // Bonus for multiple champions traded

  xp += offered.length * 10;



  // Bonus based on total offer value

  const offerValue =
    offered.reduce(
      (total, champion) =>
      total + champion.value,
      0
    );


  xp += Math.floor(
    offerValue / 25
  );



  return xp;

}


export default calculateTradeXP;