import levels from "../data/levels";


function getXPProgress(totalXP) {


  let current = levels[0];

  let next = levels[1];



  for(let i = 0; i < levels.length; i++){

    if(totalXP >= levels[i].requiredXP){

      current = levels[i];

      next = levels[i + 1] || levels[i];

    }

  }



  const range =
    next.requiredXP - current.requiredXP;


  const progress =
    totalXP - current.requiredXP;



  return {

    current,

    next,

    percentage:
      range === 0
      ? 100
      : (progress / range) * 100

  };


}


export default getXPProgress;