function calculateLevel(xp) {


  let level = 1;


  let requiredXP = 100;



  while (xp >= requiredXP) {

    xp -= requiredXP;

    level++;

    requiredXP = level * 100;

  }



  return level;

}


export default calculateLevel;